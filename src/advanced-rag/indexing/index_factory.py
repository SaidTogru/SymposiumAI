from langchain_openai import AzureOpenAIEmbeddings, AzureChatOpenAI

from .naive_indexing import NaiveIndexBuilder
from .raptor_indexing import RaptorIndexBuilder

def index_factory(
    index_type: str,
    documents_dir: str,
    embd: AzureOpenAIEmbeddings,
    llm: AzureChatOpenAI,
    text_splitter: str = 'recursive',
    index_persist_directory: str = None):

    if index_type == "naive":
        return NaiveIndexBuilder(
            documents_dir=documents_dir,
            embd=embd,
            llm=llm,
            text_splitter=text_splitter,
            # persist_base_directory=index_persist_directory
        )
    elif index_type == "raptor":
        return RaptorIndexBuilder(
            documents_dir=documents_dir,
            embd=embd,
            model=llm
        )
    else:
        raise ValueError("Invalid index type")
