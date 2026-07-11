import os
import re

base_dir = r"e:\warehouse project\warehouse-front\src\app"

for root, dirs, files in os.walk(base_dir):
    for file in files:
        if file.endswith(".ts") or file.endswith(".html"):
            file_path = os.path.join(root, file)
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            new_content = content
            
            # Replace model imports
            new_content = new_content.replace("'../models/record.model'", "'../models/item.model'")
            new_content = new_content.replace("'../../models/record.model'", "'../../models/item.model'")
            new_content = new_content.replace("'@app/core/models/record.model'", "'@app/core/models/item.model'")
            new_content = new_content.replace("Record as WarehouseRecord", "Item")
            new_content = new_content.replace("WarehouseRecord", "Item")
            
            # Replace service usage
            new_content = new_content.replace("RecordApiService", "ItemApiService")
            new_content = new_content.replace("record-api.service", "item-api.service")
            new_content = new_content.replace("recordApi", "itemApi")
            
            # Types
            new_content = new_content.replace("<Record>", "<Item>")
            
            if new_content != content:
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Updated {file_path}")
