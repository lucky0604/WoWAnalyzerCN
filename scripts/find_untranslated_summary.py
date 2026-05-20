import os
import json

ANALYSIS_DIR = 'src/analysis/retail'
LOCALE_DIR = 'src/localization/zh'

# Regexes
import re
JSX_TEXT_RE = re.compile(r'>\s*([A-Za-z][A-Za-z\s.,!?:;\'"()-]{4,})\s*<')
JSX_ATTR_RE = re.compile(r'\b(title|label|tooltip|header|message|text)="([A-Za-z][A-Za-z\s.,!?:;\'"()-]{4,})"')
STRING_LITERAL_RE = re.compile(r'[\'"]([A-Za-z][A-Za-z\s.,!?:;\'"()-]{12,})[\'"]')

def scan_file(filepath):
    untranslated_count = 0
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        
    for match in JSX_TEXT_RE.finditer(content):
        text = match.group(1).strip()
        if text and not text.startswith('{') and not text.endswith('}') and len(text) > 3:
            untranslated_count += 1
            
    for match in JSX_ATTR_RE.finditer(content):
        untranslated_count += 1
        
    for match in STRING_LITERAL_RE.finditer(content):
        val = match.group(1)
        if '/' in val or '.' in val or val.startswith('spell_') or val.startswith('inv_') or ' ' not in val:
            continue
        start = match.start()
        preceding = content[max(0, start-30):start]
        if 't(' in preceding or 'defineMessage(' in preceding or 'id:' in preceding or 'Trans' in preceding:
            continue
        untranslated_count += 1
        
    return untranslated_count

def main():
    spec_stats = {}
    
    # Get all specs
    for root, dirs, files in os.walk(ANALYSIS_DIR):
        for file in files:
            if file.endswith(('.tsx', '.ts')) and not file.endswith('.test.tsx') and not file.endswith('.test.ts'):
                filepath = os.path.join(root, file)
                parts = os.path.normpath(filepath).split(os.sep)
                if len(parts) >= 5:
                    class_name = parts[3]
                    spec_name = parts[4]
                    spec_key = f"{class_name}/{spec_name}"
                    
                    count = scan_file(filepath)
                    if count > 0:
                        if spec_key not in spec_stats:
                            spec_stats[spec_key] = 0
                        spec_stats[spec_key] += count

    print(f"{'Class/Spec':<30} | {'Hardcoded English Blocks':<25} | {'ZH Translation Status'}")
    print("-" * 85)
    
    for spec, count in sorted(spec_stats.items()):
        # Check if content.json exists
        class_name, spec_name = spec.split('/')
        json_path = os.path.join(LOCALE_DIR, class_name, spec_name, 'content.json')
        
        status = "❌ Missing content.json"
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r', encoding='utf-8') as jf:
                    data = json.load(jf)
                    status = f"✅ Present ({len(data)} translated items)"
            except Exception:
                status = "⚠️ Invalid content.json"
                
        print(f"{spec:<30} | {count:<25} | {status}")

if __name__ == '__main__':
    main()
