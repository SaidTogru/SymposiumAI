"""This middleware class is responsible for processing saved data in the tmp directory and 
generating responses using a Language Learning Model (LLM) for confused users. 
It creates an answer and writes it into the AI.txt file, which is then displayed on the frontend.

The messages written into the AI.txt file should follow this format just as string:

SymposiumAI: @AddressedUser [Message]

The following middleware have to deal also with the following cases:
1. Every 5 Second for example it checks the faces of every user and check if one user is confused.
    1.1 If a user is confused, collect all information in the tmp folder.
    1.2 Convert the information into a format that the LLM can work with 
    (Here it is important to perhaps only collect the relevant data.)
    1.3 Use the LLM to generate a response.
    1.4 Write the response into AI.txt file. The displaying is already done by the app.js.
2. When a user is not confused, it should do nothing.
3. When a user is confused, but there is no information in the tmp folder about this user,
    it should display a default message on frontend.
"""
