from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

### Question Re-writer
def transform_query_factory(llm):
    # Prompt
    system = """You a question re-writer that converts an input question to a better version that is optimized \n
        for vectorstore retrieval. Look at the input and try to reason about the underlying sematic intent / meaning."""
    re_write_prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system),
            ("human", "Here is the initial question: \n\n {question} \n Formulate an improved question."),
        ]
    )

    question_rewriter = re_write_prompt | llm | StrOutputParser()

    def transform_query(state_dict):
        """
        Transform the query to produce a better question.

        Args:
            state (dict): The current graph state

        Returns:
            state (dict): Updates question key with a re-phrased question
        """

        print("---TRANSFORM QUERY---")
        user_query = state_dict["user_query"]

        # Re-write question
        better_question = question_rewriter.invoke({"question": user_query})

        return {
            "user_query": better_question,
        }
    return transform_query
