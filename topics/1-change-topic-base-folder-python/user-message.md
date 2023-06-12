- now update the code so that:

1. scratchpad should be configurable in the following way
   1. user-message.md message should contain property which is the scratchpad file name
   2. it can be configured to automatically calculate which split should be used, split separator sfh-split-file-here

2. the scrachpad should be able to be an file with an absolute path, so when getting the file path check if it exists, 
   and if it does not exist then make it relative to the topic folder 
3. do the same for system message so that it can be picked

If at any points the files are not found then report an error and exit

OK, scratch that. I think I have a better idea. 
The user-message.md should be the input file which contains multiple properties:
1. system message file name (can be absolute or relative)
2. scratchpad file name (can be absolute or relative)
3. user message, can be multiline text
4. log folder name, which by default should be the same folder as the user-message.md file

Do, these changes and tell me if there are any other improvements you can think of.