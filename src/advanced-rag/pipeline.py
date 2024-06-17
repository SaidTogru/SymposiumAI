from typing import List, Dict, Tuple

from .query_translation import transform_query_factory
from .indexing import index_factory
from .retrieval import retrieve_factory
from .generation import generation_factory
from .flow_control import decide_to_generate, decide_to_retrieve, prepare_for_final_grade
from .evaluation.retrieval import grade_documents_factory
from .evaluation.generation import grade_generation_v_documents_factory, grade_generation_v_question_factory
from .utils import GraphState

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langgraph.graph import END, StateGraph

class RAGPipeline:
    def __init__(
        self,
        self_correction: bool,
        documents_dir: str,
        api_key: str,
        index_persist_directory: str = None,
        index_type: str  = 'naive',
        text_splitter: str = 'recursive'
        ) -> None:

        self.llm = ChatOpenAI(
            # model = 'gpt-4o',
            api_key=api_key,
        )
        self.embd = OpenAIEmbeddings(
            # model='text-embedding-3-small',
            api_key=api_key,
        )

        self.index_type = index_type
        self.text_splitter = text_splitter
        self.index_persist_directory = index_persist_directory


        index = index_factory(
            index_type,
            documents_dir,
            self.embd,
            self.llm,
            text_splitter,
            index_persist_directory
        )

        vectorstore = index.get_vectorstore()

        workflow = StateGraph(GraphState)

        # Define the nodes
        workflow.add_node("grade_initial_documents", grade_documents_factory(self.llm)) 
        workflow.add_node("retrieve", retrieve_factory(vectorstore))
        workflow.add_node("generate", generation_factory(self.llm))

        # Build graph
        workflow.set_entry_point("grade_initial_documents")

        if self_correction:
            workflow.add_node("grade_documents", grade_documents_factory(self.llm)) 
            workflow.add_node("transform_query", transform_query_factory(self.llm))
            workflow.add_node("prepare_for_final_grade", prepare_for_final_grade)

            workflow.add_conditional_edges(
                "grade_initial_documents",
                decide_to_retrieve,
                {
                    "retrieve": "retrieve",
                    "generate": "generate",
                },
            )

            workflow.add_edge("retrieve", "grade_documents")

            workflow.add_conditional_edges(
                "grade_documents",
                decide_to_generate,
                {
                    "transform_query": "transform_query",
                    "generate": "generate",
                },
            )
            workflow.add_edge("transform_query", "retrieve")

            workflow.add_conditional_edges(
                "generate",
                grade_generation_v_documents_factory(self.llm),
                {
                    "supported": "prepare_for_final_grade",
                    "not supported": "generate",
                },
            )

            workflow.add_conditional_edges(
                "prepare_for_final_grade",
                grade_generation_v_question_factory(self.llm),
                {
                    "useful": END,
                    "not useful": "transform_query",
                },
            )
        else:
            workflow.add_conditional_edges(
                "grade_initial_documents",
                decide_to_retrieve,
                {
                    "retrieve": "retrieve",
                    "generate": "generate",
                },
            )
            workflow.add_edge("retrieve", "generate")
            workflow.add_edge("generate", END)

        # Compile
        self.rag = workflow.compile()

    def __call__(
        self,
        query: str,
        addressee: str = None,
        chat_history: List[Tuple[str, str]] = None,
        previously_retrieved_docs: List[any] = None,
        top_k=5
    ) -> Dict[str, str]:

        graph_state = GraphState(
            user_query=query,
            addressee=addressee,
            chat_history=chat_history,
            top_k=top_k,
            documents=previously_retrieved_docs,
        )
        return self.rag.invoke(graph_state)


rag = RAGPipeline(
    documents_dir="src/advanced-rag/db/raw_documents",
    api_key="API_KEY",
    self_correction=False,
    text_splitter="recursive"
)
result = rag("Explain the role of delta in the selectivity mechanism of Mamba", addressee='Marco', chat_history=[], previously_retrieved_docs=[])
print(result["answer"])
