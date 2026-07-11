import os

base_dir = r"e:\warehouse project\warehouse-front\src\app"

for root, dirs, files in os.walk(base_dir):
    for file in files:
        if file.endswith(".ts") or file.endswith(".html"):
            file_path = os.path.join(root, file)
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            new_content = content
            
            # State replacements
            new_content = new_content.replace("appState.records", "appState.items")
            new_content = new_content.replace("selectedRecordIds", "selectedItemIds")
            new_content = new_content.replace("filteredRecords", "filteredItems")
            new_content = new_content.replace("targetRecords", "targetItems")
            new_content = new_content.replace("selectedRecords", "selectedItems")
            
            if new_content != content:
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Updated {file_path}")
