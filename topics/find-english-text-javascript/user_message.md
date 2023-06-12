I want this script to prompt the user with German language.
Find all relevant texts.

As a positive example consider:
$email.after(`<label id="email-error" class="error" for="email">Please enter a valid email address</label>`); .

This is one of the instructions that I want you to extract.

As a negative example consider:
logThisState("inlineCP:submitHandler: startCheckout");
this is a negative example because this is only for logging and logging is OK to be in English.

Now please extract all instructions that could show the user english text.
