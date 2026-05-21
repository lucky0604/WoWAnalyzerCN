import os
import re

DRUID_DIR = 'src/analysis/retail/druid'

JSX_TEXT_RE = re.compile(r'>\s*([A-Za-z][A-Za-z\s.,!?:;\'"()/-]{3,})\s*<')
JSX_ATTR_RE = re.compile(r'\b(title|label|tooltip|header|message|text)="([A-Za-z][A-Za-z\s.,!?:;\'"()/-]{3,})"')
STRING_LITERAL_RE = re.compile(r'[\'"]([A-Za-z][A-Za-z\s.,!?:;\'"()/-]{10,})[\'"]')

def scan_file(filepath):
    untranslated = []
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        
    for match in JSX_TEXT_RE.finditer(content):
        text = match.group(1).strip()
        if text and not text.startswith('{') and not text.endswith('}') and len(text) > 3:
            untranslated.append(('JSX text', text, match.start()))
            
    for match in JSX_ATTR_RE.finditer(content):
        attr, value = match.group(1), match.group(2)
        untranslated.append((f'JSX attr {attr}', value, match.start()))
        
    for match in STRING_LITERAL_RE.finditer(content):
        val = match.group(1)
        if '/' in val or '.' in val or val.startswith('spell_') or val.startswith('inv_') or ' ' not in val:
            continue
        start = match.start()
        preceding = content[max(0, start-30):start]
        if 't(' in preceding or 'defineMessage(' in preceding or 'id:' in preceding or 'Trans' in preceding:
            continue
        untranslated.append(('String literal', val, start))
        
    return untranslated

def get_line_number(filepath, pos):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    return content.count('\n', 0, pos) + 1

def main():
    druid_issues = {}
    for root, dirs, files in os.walk(DRUID_DIR):
        for file in files:
            if file.endswith(('.tsx', '.ts')) and not file.endswith('.test.tsx') and not file.endswith('.test.ts'):
                filepath = os.path.join(root, file)
                untranslated = scan_file(filepath)
                if untranslated:
                    druid_issues[filepath] = []
                    for item_type, text, pos in untranslated:
                        line = get_line_number(filepath, pos)
                        druid_issues[filepath].append({
                            'line': line,
                            'type': item_type,
                            'text': text
                        })
                        
    for f, items in sorted(druid_issues.items()):
        print(f"File: {f}")
        for item in items:
            print(f"  Line {item['line']} [{item['type']}]: \"{item['text']}\"")
        print("-" * 50)

if __name__ == '__main__':
    main()
