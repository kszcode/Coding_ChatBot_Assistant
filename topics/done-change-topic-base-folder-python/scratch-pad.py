import argparse
import json
import os
import re
import textwrap
import time
from datetime import datetime
from typing import Any, Union
from typing import List

import openai


class AppState:
    def __init__(self):
        self.MODEL_NAME = "gpt-4"
        self.MODEL_TEMPERATURE = 0.1
        self.MODEL_MAX_TOKENS = 7500
        self.USER_MESSAGE_FILE = 'user-message.md'
        self.SYSTEM_MESSAGE_FILE = 'system-message.md'
        self.SCRATCH_PAD_FILE = 'scratch-pad.py'
        self.TOPIC_FOLDER = os.path.join(os.getcwd(), 'topics/1-change-topic-base-folder-python')
        self.ALL_MESSAGES = list()
        self.user_message = ""

    def for_topic_get(self, file_path):
        if os.path.exists(file_path):
            return file_path
        else:
            return os.path.join(self.TOPIC_FOLDER, file_path)

    def read_user_message_file(self):
        file_path = self.for_topic_get(app_state.USER_MESSAGE_FILE)
        content = read_file_content(file_path)
        properties = {
            'system_message_file': '',
            'scratchpad_file': '',
            'split_index': None,
            'user_message': '',
            'log_folder': os.path.dirname(file_path),
        }

        for line in content.splitlines():
            if line.startswith('system_message_file:'):
                properties['system_message_file'] = line.split(':', 1)[1].strip()
            elif line.startswith('scratchpad_file:'):
                properties['scratchpad_file'] = line.split(':', 1)[1].strip()
            elif line.startswith('split_index:'):
                properties['split_index'] = int(line.split(':', 1)[1].strip())
            elif line.startswith('user_message:'):
                properties['user_message'] = line.split(':', 1)[1].strip()
            else:
                properties['user_message'] += '\n' + line

        if properties['system_message_file'] is not None and properties['system_message_file'] != '':
            self.SYSTEM_MESSAGE_FILE = properties['system_message_file']
        if properties['scratchpad_file'] is not None and properties['scratchpad_file'] != '':
            self.SCRATCH_PAD_FILE = properties['scratchpad_file']

        self.user_message = properties['user_message']


app_state = AppState()


# Section:    logging for debug functions

def create_log_file(suffix: str) -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_dir = app_state.for_topic_get("./")
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    log_file = os.path.join(log_dir, f"{timestamp}{suffix}")
    return log_file


def save_request_as_human_readable_text(conversation, suffix):
    log_file = create_log_file(suffix)
    human_readable_text = ""
    for message in conversation:
        if 'role' in message and 'content' in message:
            human_readable_text += f"# {message['role'].upper()}:\n{message['content']}\n\n"
        else:
            print(f"Skipping message due to missing 'role' or 'content': {message}")
    save_content_to_file(log_file, human_readable_text)


def save_response_as_human_readable_text(response, total_tokens, duration, suffix=""):
    log_file = create_log_file(suffix)
    conversation: List[dict] = response["choices"]
    human_readable_text = f"- Model      : {app_state.MODEL_NAME}\n"
    human_readable_text += f"- Temperature: {app_state.MODEL_TEMPERATURE}\n"
    human_readable_text += f"- Tokens     : {total_tokens}\n"
    human_readable_text += f"- Duration   : {duration}\n"
    human_readable_text += "\n\n"
    for message in conversation:
        message = message["message"]
        if 'role' in message and 'content' in message:
            human_readable_text += f"# {message['role'].upper()}:\n{message['content']}\n\n"
        else:
            print(f"Skipping message due to missing 'role' or 'content': {message}")
    save_content_to_file(log_file, human_readable_text)


def pretty_print_json(conversation: Any) -> Union[str, Any]:
    try:
        return json.dumps(conversation, indent=4, sort_keys=True)
    except Exception:
        return conversation


def save_json_log(conversation, suffix, pretty_print=True):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_dir = "log/openai"
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    log_file = os.path.join(log_dir, f"{timestamp}{suffix}.json")
    if pretty_print:
        conversation = pretty_print_json(conversation)
    save_content_to_file(log_file, str(conversation))


# Section:     file operations

def save_content_to_file(filepath, content):
    with open(filepath, 'w', encoding='utf-8') as outfile:
        outfile.write(content)


def read_file_content(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as infile:
            return infile.read()
    except FileNotFoundError:
        print(f"File {filepath} not found.")
        exit(1)


# Section:     API functions

def fetch_chatbot_response(conversation: List[dict]) -> dict:
    return openai.ChatCompletion.create(
        model=app_state.MODEL_NAME,
        messages=conversation,
        temperature=app_state.MODEL_TEMPERATURE,
        # max_tokens=app_state.MODEL_MAX_TOKENS,
    )


def handle_error(error, conversation):
    print(f'\n\nError communicating with OpenAI: "{error}"')
    if 'maximum context length' in str(error):
        conversation.pop(0)
        print('\n\n DEBUG: Trimming oldest message')
        return True, conversation
    return False, conversation


def perform_chatbot_conversation(conversation: List[dict]) -> tuple[Any, Any, float]:
    max_retry: int = 7

    # Save the conversation to a log file
    save_json_log(conversation, f'_{app_state.MODEL_NAME}_request')
    save_request_as_human_readable_text(conversation, f"_{app_state.MODEL_NAME}_request.md")

    for retry in range(max_retry):
        try:
            start_time = time.time()
            print("INFO: Processing...")

            response = fetch_chatbot_response(conversation)
            text = response['choices'][0]['message']['content']
            total_tokens = response['usage']['total_tokens']

            end_time = time.time()
            processing_time = end_time - start_time

            save_json_log(response, f'_{total_tokens}_response', False)
            save_response_as_human_readable_text(
                response, total_tokens, processing_time,
                f"_{total_tokens}_response.md",
            )

            return text, total_tokens, processing_time
        except Exception as oops:
            should_continue, conversation = handle_error(oops, conversation)
            if not should_continue:
                wait_time = 2 ** retry * 5
                print(f'\n\nRetrying in {wait_time} seconds...')
                time.sleep(wait_time)
            else:
                continue

    print(f"\n\nExiting due to excessive errors in API.")
    exit(1)


###     MAIN LOOP


def multi_line_input():
    print('\n\n\nType END to save and exit.\n[MULTI] USER:\n')
    lines = []
    while True:
        line = input()
        if line == "END":
            break
        lines.append(line)
    return "\n".join(lines)


def print_chatbot_response(response, total_tokens, processing_time):
    print('\n\n\n\nCHATBOT response:\n')
    formatted_lines = [textwrap.fill(line, width=120) for line in response.split('\n')]
    formatted_text = '\n'.join(formatted_lines)
    print(formatted_text)
    print(f'\n\nINFO: {app_state.MODEL_NAME}: {total_tokens} tokens, {processing_time:.2f} seconds')


def read_scratchpad_file(file_path, split_index=None):
    content = read_file_content(file_path)
    if split_index is not None:
        splits = re.split(r'\n\s*sfh-split-file-here\s*\n', content)
        if split_index < len(splits):
            return splits[split_index]
        else:
            print(f"Error: split_index {split_index} is out of range.")
            exit(1)
    else:
        return content


def main():
    # instantiate chatbot
    openai.api_key = read_file_content('key_openai.txt').strip()

    app_state.read_user_message_file()

    print(f"Current settings:\n"
          f"Model: {app_state.MODEL_NAME}\n"
          f"Temperature: {app_state.MODEL_TEMPERATURE}")
    print("Sample app usage: python chat.py --model gpt-3.5-turbo --temperature 0.2")

    print(f"\n\nInput files:\n"
          f"Topic folder: {app_state.TOPIC_FOLDER}\n"
          f"User message: {app_state.USER_MESSAGE_FILE}\n"
          f"System message: {app_state.SYSTEM_MESSAGE_FILE}\n"
          f"Scratchpad: {app_state.SCRATCH_PAD_FILE}")

    print(f"\n\nUser message is:"
          f"\n{read_file_content(app_state.user_message)}"
          f"\n\n")

    # continue with composing conversation and response
    app_state.ALL_MESSAGES.append({'role': 'user', 'content': app_state.user_message})
    system_message = read_file_content(
        app_state.for_topic_get(app_state.SYSTEM_MESSAGE_FILE),
    ).replace('<<CODE>>', read_file_content(app_state.for_topic_get(app_state.SCRATCH_PAD_FILE)))
    conversation = list()
    conversation += app_state.ALL_MESSAGES
    conversation.append({'role': 'system', 'content': system_message})

    # generate a response
    response, tokens, processing_time = perform_chatbot_conversation(conversation)

    if tokens > app_state.MODEL_MAX_TOKENS:
        app_state.ALL_MESSAGES.pop(0)

    app_state.ALL_MESSAGES.append({'role': 'assistant', 'content': response})
    print_chatbot_response(response, tokens, processing_time)


if __name__ == '__main__':
    main()
