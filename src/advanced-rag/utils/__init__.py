from typing import List, Tuple, TypedDict


class GraphState(TypedDict):
    """
    Represents the state of our graph.

    Attributes:
        keys: A dictionary where each key is a string.
    """

    user_query: str
    addressee: str
    chat_history: List[Tuple[str, str]]
    top_k: int
    documents: List[any]
    answer: str
