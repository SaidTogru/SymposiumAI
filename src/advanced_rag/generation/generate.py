from langchain import hub
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import AzureChatOpenAI

def generation_factory(llm: AzureChatOpenAI):
    def generate_answer(state_dict: dict):
        """
        Generate answer

        Args:
            state (dict): The current graph state

        Returns:
            state (dict): New key added to state, generation, that contains LLM generation
        """
        print("---GENERATE---")
        user_query = state_dict["user_query"]
        addressee = state_dict["addressee"]
        chat_history = state_dict["chat_history"]
        documents = state_dict["documents"]

        prompt = ChatPromptTemplate.from_messages([
            (
                "system",
                "You are a bystander in a multi-party conversation. You are asked to provide \
                a detailed technical answer and assistance in accordance to the chat history. \
                The chat history consists of a transcript of a meeting where each participant is denoted by name. \
                The conversation is technical in nature and the participants are discussing a technical topic. \
                When you are asked to provide an anwer it means that our facial detection algorithm has \
                detected that at least one participant is in need of assistiance or clarification. \
                The name of the participant in need of assistance is provided below. Given the chat history \
                you must address this participant by name via @{addressee} and provide a summary of the very recent conversation. \
                If the conversation is technical in nature you must retrieve the relevant technical documents or papers \
                and provide a detailed technical answer. You must also anticipate any questions that the participant may have \
                and provide a detailed answer to those questions as well."
            ),
            (
                "system",
                "Leverage the chat history and the technical reports or papers \
                provided as context to ensure your answers respect the continuity \
                of the conversation and maintain the high level of detail expected \
                in technical discussions. If the query requires it, explain complex \
                reasoning or derivations clearly."
            ),
            (
                "placeholder",
                "{chat_history}"
            ),
            (
                "human",
                "\nQuestion: {user_query}\n\nAddressee: {addressee}\n\nContext: {context}\n\nAnswer:"
            )
        ])

        # Chain
        rag_chain = prompt | llm | StrOutputParser()

        # Run
        answer = rag_chain.invoke(
            {"context": documents, "user_query": user_query, "chat_history": chat_history, "addressee": addressee}
        )
        return {
            "answer": answer
        }
    return generate_answer
