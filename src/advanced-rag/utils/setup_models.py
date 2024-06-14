import os

from langchain_openai import AzureChatOpenAI, AzureOpenAIEmbeddings


def setup_models(llm_config, embedding_config):
    llm = AzureChatOpenAI(
        openai_api_version=llm_config["openai_api_version"],
        azure_endpoint=llm_config["azure_endpoint"],
        azure_deployment=llm_config["azure_deployment"],
        model=llm_config["model"],
        api_key=llm_config["api_key"],
        validate_base_url=False,
    )

    embd = AzureOpenAIEmbeddings(
        openai_api_version=embedding_config["openai_api_version"],
        azure_endpoint=embedding_config["azure_endpoint"],
        azure_deployment=embedding_config["azure_deployment"],
        model=embedding_config["model"],
        api_key=embedding_config["api_key"],
    )

    return llm, embd
