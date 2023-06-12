- `SYSTEM_MESSAGE_FILE`: system-message-javascript-assistant.txt
- `SCRATCH_PAD_FILE`: appLogic.ts
- `SCRATCH_PAD_SPLIT_TEXT`: sfh-split-file-here
- `SCRATCH_PAD_SPLIT_INDEX`: 1
- `TOPIC_FOLDER`: 
 # - `MODEL_NAME`: gpt-4
- `MODEL_TEMPERATURE`: 0.2 
- `user_message`: 

I want this script to prompt the user with German language.
Find all relevant texts.

As a positive example consider:
$email.after(`<label id="email-error" class="error" for="email">Please enter a valid email address</label>`); .

This is one of the instructions that I want you to extract.

As a negative example consider:
logThisState("inlineCP:submitHandler: startCheckout");
this is a negative example because this is only for logging and logging is OK to be in English.

Now please extract all instructions that could show the user english text.

 # /Users/km1/2code/python-projects/Coding_ChatBot_Assistant/
 # --user_message_file topics/1-find-english-text-javascript/user_message.md