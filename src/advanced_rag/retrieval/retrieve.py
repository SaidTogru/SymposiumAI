from typing import Dict

from langchain_community.vectorstores.chroma import Chroma


def retrieve_factory(vectorstore: Chroma):
    def retrieve_context(state_dict: dict):
        """
        Retrieve documents

        The filter_dict was constructed through reffering to these sources:
            - https://stackoverflow.com/questions/78489329/how-to-filter-documents-based-on-a-list-of-metadata-in-langchains-chroma-vector
            - https://github.com/langchain-ai/langchain/issues/2095#issuecomment-1538836809

        We are using the vectorstore directly as a retriever through the similarity_search
        method because it allows for better filtering. The VectorStoreRetriever objects are
        just a wrapper around this functionality.

        Args:
            state (dict): The current graph state

        Returns:
            state (dict): New key added to state, documents, that contains retrieved documents
        """
        print("---RETRIEVE---")


        user_query = state_dict["user_query"]
        top_k = state_dict["top_k"]
        
        documents = vectorstore.similarity_search(user_query, k=top_k)
        return {
                "documents": documents,
        }
    return retrieve_context
