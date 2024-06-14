import os

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_experimental.text_splitter import SemanticChunker
from langchain_community.vectorstores.chroma import Chroma
from langchain_openai import AzureOpenAIEmbeddings, AzureChatOpenAI
from langchain_community.document_loaders.pdf import UnstructuredPDFLoader

from .index_interface import IndexInterface

class NaiveIndexBuilder(IndexInterface):
    def __init__(
        self,
        documents_dir: str,
        embd: AzureOpenAIEmbeddings,
        llm: AzureChatOpenAI,
        text_splitter: str) -> None:

        self.documents_dir = documents_dir

        persist_base_directory = os.path.join(os.getcwd(), "src", "advanced-rag", "db", "vectorstores")
        self.persist_directory = os.path.join(
            persist_base_directory, text_splitter
        )

        self.embd = embd
        self.llm = llm

        self.text_splitter = text_splitter

        self.vectorstore = None

    def index_exists(self):
        """Check if the index directory exists and is not empty."""
        return os.path.exists(self.persist_directory) and \
               os.path.isdir(self.persist_directory) and \
               bool(os.listdir(self.persist_directory))

    def build_index(self):
        # Add to vectorDB
        if not self.index_exists():
            # load pfd from the documents directory
            data = []
            file_paths = [os.path.join(self.documents_dir, f) for f in os.listdir(self.documents_dir) if f.endswith('.pdf')]
            for file in file_paths:
                loader = UnstructuredPDFLoader(
                    file_path=file,
                )
                data.extend(loader.load())

            if self.text_splitter == "recursive":
                text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
                    chunk_size=256, chunk_overlap=0
                )
            elif self.text_splitter == "semantic":
                text_splitter = SemanticChunker(self.embd)
            else:
                raise ValueError("Invalid text_splitter")

            doc_splits = text_splitter.split_documents(data)

            self.vectorstore = Chroma.from_documents(
                documents=doc_splits,
                embedding=self.embd,
                persist_directory=self.persist_directory,
            )
        else:
            self.vectorstore = Chroma(
                embedding_function=self.embd,
                persist_directory=self.persist_directory,
            )

    def get_vectorstore(self):
        if not self.vectorstore:
            self.build_index()
        return self.vectorstore

