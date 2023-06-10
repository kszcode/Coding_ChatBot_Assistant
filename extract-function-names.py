import os
import ast
import json


def get_functions(file_path):
    with open(file_path, "r") as source_code:
        tree = ast.parse(source_code.read())
        functions = [node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
    return functions


def scan_directory(path):
    directory_data = {}
    for root, dirs, files in os.walk(path):
        for file in files:
            if file.endswith('.py'):
                file_path = os.path.join(root, file)
                folder = os.path.dirname(file_path) + '/'
                if folder not in directory_data:
                    directory_data[folder] = {}
                directory_data[folder][file] = {"list-of-functions": get_functions(file_path)}
    return directory_data


def main():
    folder_name = os.getcwd()
    data = scan_directory(folder_name)
    with open('output.json', 'w') as json_file:
        json.dump(data, json_file, indent=4)


if __name__ == "__main__":
    main()
