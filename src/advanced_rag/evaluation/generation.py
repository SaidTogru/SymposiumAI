from langchain.output_parsers.openai_tools import PydanticToolsParser
from langchain.prompts import PromptTemplate
from langchain_core.pydantic_v1 import BaseModel, Field
from langchain_core.utils.function_calling import convert_to_openai_tool
from langchain_openai import AzureChatOpenAI

def grade_generation_v_documents_factory(model: AzureChatOpenAI):
    def grade_generation_v_documents(state_dict):
        """
        Determines whether the generation is grounded in the document.

        Args:
            state (dict): The current state of the agent, including all keys.

        Returns:
            str: Binary decision
        """

        print("---GRADE GENERATION vs DOCUMENTS---")
        documents = state_dict["documents"]
        generation = state_dict["answer"]

        # Data model
        class grade(BaseModel):
            """Binary score for relevance check."""

            binary_score: str = Field(description="Supported score 'yes' or 'no'")

        # Tool
        grade_tool_oai = convert_to_openai_tool(grade)

        # LLM with tool and enforce invocation
        llm_with_tool = model.bind(
            tools=[grade_tool_oai],
            tool_choice={"type": "function", "function": {"name": "grade"}},
        )

        # Parser
        parser_tool = PydanticToolsParser(tools=[grade])

        # Prompt
        prompt = PromptTemplate(
            template="""You are a grader assessing whether an answer is grounded in / supported by a set of facts. \n
            Here are the facts:
            \n ------- \n
            {documents}
            \n ------- \n
            Here is the answer: {generation}
            Give a binary score 'yes' or 'no' to indicate whether the answer is grounded in / supported by a set of facts.""",
            input_variables=["generation", "documents"],
        )

        # Chain
        chain = prompt | llm_with_tool | parser_tool

        score = chain.invoke({"generation": generation, "documents": documents})
        grade = score[0].binary_score

        if grade == "yes":
            print("---DECISION: SUPPORTED, MOVE TO FINAL GRADE---")
            return "supported"
        else:
            print("---DECISION: NOT SUPPORTED, GENERATE AGAIN---")
            return "not supported"
    return grade_generation_v_documents


def grade_generation_v_question_factory(model: AzureChatOpenAI):
    def grade_generation_v_question(state_dict):
        """
        Determines whether the generation addresses the question.

        Args:
            state (dict): The current state of the agent, including all keys.

        Returns:
            str: Binary decision
        """

        print("---GRADE GENERATION vs QUESTION---")
        question = state_dict["user_query"]
        generation = state_dict["answer"]

        # Data model
        class grade(BaseModel):
            """Binary score for relevance check."""

            binary_score: str = Field(description="Useful score 'yes' or 'no'")

        # Tool
        grade_tool_oai = convert_to_openai_tool(grade)

        # LLM with tool and enforce invocation
        llm_with_tool = model.bind(
            tools=[grade_tool_oai],
            tool_choice={"type": "function", "function": {"name": "grade"}},
        )

        # Parser
        parser_tool = PydanticToolsParser(tools=[grade])

        # Prompt
        prompt = PromptTemplate(
            template="""You are a grader assessing whether an answer is useful to resolve a question. \n
            Here is the answer:
            \n ------- \n
            {generation}
            \n ------- \n
            Here is the question: {question}
            Give a binary score 'yes' or 'no' to indicate whether the answer is useful to resolve a question.""",
            input_variables=["generation", "question"],
        )

        # Prompt
        chain = prompt | llm_with_tool | parser_tool

        score = chain.invoke({"generation": generation, "question": question})
        grade = score[0].binary_score

        if grade == "yes":
            print("---DECISION: USEFUL---")
            return "useful"
        else:
            print("---DECISION: NOT USEFUL---")
            return "not useful"
    return grade_generation_v_question
