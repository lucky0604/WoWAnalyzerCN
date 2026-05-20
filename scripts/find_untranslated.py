import os
import re

# Directory to scan
ANALYSIS_DIR = 'src/analysis/retail'

# Regular expressions to find hardcoded English text in JSX
# 1. Text nodes in JSX: e.g. <Tag>Some English Text</Tag> or just plain text inside JSX.
# A regex to match content between > and < in JSX.
JSX_TEXT_RE = re.compile(r'>\s*([A-Za-z][A-Za-z\s.,!?:;\'"()-]{4,})\s*<')

# 2. JSX attributes with string literals: title="Some Text", label="Some Text", tooltip="Some Text"
JSX_ATTR_RE = re.compile(r'\b(title|label|tooltip|header|message|text)="([A-Za-z][A-Za-z\s.,!?:;\'"()-]{4,})"')

# 3. String literals in JS/TS: e.g. "Some English text" or 'Some English text'
# We focus on longer strings (>=15 chars) that are not inside i18n functions.
# To keep false positives low, we'll scan TSX files.
STRING_LITERAL_RE = re.compile(r'[\'"]([A-Za-z][A-Za-z\s.,!?:;\'"()-]{12,})[\'"]')

def scan_file(filepath):
    untranslated = []
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        
    # Check if the file imports Trans or t
    has_i18n_import = 'Trans' in content or 't(' in content or 'defineMessage' in content
    
    # 1. Find JSX text nodes
    for match in JSX_TEXT_RE.finditer(content):
        text = match.group(1).strip()
        # Ignore common tags or variable names
        if text and not text.startswith('{') and not text.endswith('}') and len(text) > 3:
            untranslated.append(('JSX text node', text, match.start()))
            
    # 2. Find JSX attributes with string literals
    for match in JSX_ATTR_RE.finditer(content):
        attr, value = match.group(1), match.group(2)
        untranslated.append((f'JSX attribute {attr}', value, match.start()))
        
    # 3. Find string literals (heuristic, filtering out typical imports/keys/non-user-facing strings)
    # We ignore strings that look like import paths, keys with dots, or classNames.
    for match in STRING_LITERAL_RE.finditer(content):
        val = match.group(1)
        # Filters:
        if '/' in val or '.' in val or val.startswith('spell_') or val.startswith('inv_') or ' ' not in val:
            continue
        # Check if the match is wrapped in t() or Trans
        # Simple check: look at preceding characters
        start = match.start()
        preceding = content[max(0, start-30):start]
        if 't(' in preceding or 'defineMessage(' in preceding or 'id:' in preceding or 'Trans' in preceding:
            continue
        untranslated.append(('String literal', val, start))
        
    return untranslated, has_i18n_import

def get_line_number(filepath, pos):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    return content.count('\n', 0, pos) + 1

def main():
    specs_summary = {}
    
    for root, dirs, files in os.walk(ANALYSIS_DIR):
        for file in files:
            if file.endswith(('.tsx', '.ts')) and not file.endswith('.test.tsx') and not file.endswith('.test.ts'):
                filepath = os.path.join(root, file)
                # Determine class and spec from path
                parts = os.path.normpath(filepath).split(os.sep)
                # src/analysis/retail/class_name/spec_name/...
                if len(parts) >= 5:
                    class_name = parts[3]
                    spec_name = parts[4]
                    spec_key = f"{class_name}/{spec_name}"
                else:
                    continue
                    
                untranslated, has_i18n = scan_file(filepath)
                if untranslated:
                    if spec_key not in specs_summary:
                        specs_summary[spec_key] = []
                    for item_type, text, pos in untranslated:
                        line_num = get_line_number(filepath, pos)
                        specs_summary[spec_key].append({
                            'file': filepath,
                            'line': line_num,
                            'type': item_type,
                            'text': text
                        })
                        
    # Sort and print results
    print("=== SCANNED SPECS AND HARDCODED ENGLISH STRINGS ===")
    total_specs = len(specs_summary)
    print(f"Found {total_specs} specs with untranslated strings:\n")
    
    for spec_key, items in sorted(specs_summary.items()):
        print(f"Spec: {spec_key} ({len(items)} issues)")
        # Group by file
        files_group = {}
        for item in items:
            f = item['file']
            if f not in files_group:
                files_group[f] = []
            files_group[f].append(item)
            
        for f, f_items in files_group.items():
            print(f"  File: {f}")
            for item in f_items[:15]: # Show top 15 issues per file to keep output reasonable
                print(f"    Line {item['line']} [{item['type']}]: \"{item['text']}\"")
            if len(f_items) > 15:
                print(f"    ... and {len(f_items) - 15} more issues in this file")
        print("-" * 50)

if __name__ == '__main__':
    main()
