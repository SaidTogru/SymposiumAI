### Retrieval Grader

from langchain.prompts import PromptTemplate
from langchain_core.pydantic_v1 import BaseModel, Field
from langchain_core.utils.function_calling import convert_to_openai_tool
from langchain.output_parsers.openai_tools import PydanticToolsParser
from langchain_openai import AzureChatOpenAI

def grade_documents_factory(llm: AzureChatOpenAI):
    def grade_documents(state_dict: dict):
        """
        Determines whether the retrieved documents are relevant to the question.

        Args:
            state (dict): The current state of the agent, including all keys.

        Returns:
            dict: New key added to state, filtered_documents, that contains relevant documents.
        """

        print("---CHECK RELEVANCE---")

        user_query = state_dict["user_query"]
        chat_history = state_dict["chat_history"]
        documents = state_dict["documents"]

        # Data model
        class grade(BaseModel):
            """Binary score for relevance check."""

            binary_score: str = Field(description="Relevance score 'yes' or 'no'")

        # Tool
        grade_tool_oai = convert_to_openai_tool(grade)

        # LLM with tool and enforce invocation
        llm_with_tool = llm.bind(
            tools=[convert_to_openai_tool(grade_tool_oai)],
            tool_choice={"type": "function", "function": {"name": "grade"}},
        )

        # Parser
        parser_tool = PydanticToolsParser(tools=[grade])

        # Prompt
        prompt = PromptTemplate(
            template="""You are a grader assessing relevance of a retrieved document to a user question. \n
            Here is the retrieved document: \n\n {context} \n\n
            Here is the conversation history: {chat_history} \n
            Here is the user question: {question} \n
            If the document contains keyword(s) or semantic meaning related to the user question in the context
            of the given chat history, grade it as relevant. \n
            Give a binary score 'yes' or 'no' score to indicate whether the document is relevant to the question.""",
            input_variables=["context", "question", "chat_history"],
        )

        # Chain
        chain = prompt | llm_with_tool | parser_tool

        # Score
        filtered_docs = []
        for d in documents:
            score = chain.invoke({"question": user_query, "context": d.page_content, "chat_history": chat_history})
            grade = score[0].binary_score
            if grade == "yes":
                print("---GRADE: DOCUMENT RELEVANT---")
                filtered_docs.append(d)
            else:
                print("---GRADE: DOCUMENT NOT RELEVANT---")
                continue

        return {
            "documents": filtered_docs,
        }
    return grade_documents
