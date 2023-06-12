- `SYSTEM_MESSAGE_FILE`: system-message-javascript-assistant.txt
- `SCRATCH_PAD_FILE`: appLogic.ts
- `SCRATCH_PAD_SPLIT_TEXT`: sfh-split-file-here
- `SCRATCH_PAD_SPLIT_INDEX`: 9
- `TOPIC_FOLDER`:
- `MODEL_NAME`: gpt-3.5-turbo
- `MODEL_TEMPERATURE`: 0.2 
- `user_message`: 

I want this script to prompt the user with German language.
Find all relevant texts.

As a positive example consider:
$email.after(`<label id="email-error" class="error" for="email">Please enter a valid email address</label>`); .

This is one of the instructions that I want you to extract.

Please exclude the following functions: logThisState(), outputLocalizedText(), ga(), window.epSubs.track*()
these are negative examples because they are used for logging which is OK to be in English.

Now please extract all instructions that could show the user english text.

