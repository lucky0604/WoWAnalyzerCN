#!/usr/bin/env python3
"""
Lingui placeholder consistency checker.
Compares ZH translations against EN source to detect placeholder mismatches
that would cause "Can't use element at index 'X' as it is not declared" errors.

The check runs against the EFFECTIVE runtime catalog: zh/**/content.json
overrides are merged over zh/messages.json (same order as I18nProvider.tsx),
so content.json values are validated too.

Usage:
  python3 scripts/check-placeholders.py                    # check all
  python3 scripts/check-placeholders.py --fix             # auto-fix mismatches in messages.json
  python3 scripts/check-placeholders.py --spec=mage.frost # filter by spec prefix
  python3 scripts/check-placeholders.py --ci              # exit code 1 if any mismatch (for CI)
"""

import json, re, sys, os, glob

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EN_PATH = os.path.join(PROJECT_ROOT, 'src/localization/en/messages.json')
ZH_PATH = os.path.join(PROJECT_ROOT, 'src/localization/zh/messages.json')


def load_messages(merge_content=True):
    with open(EN_PATH, 'r') as f:
        en = json.load(f)
    with open(ZH_PATH, 'r') as f:
        zh = json.load(f)
    if merge_content:
        # content.json overrides messages.json at runtime — merge in the same order.
        for f in glob.glob(os.path.join(PROJECT_ROOT, 'src/localization/zh/**/content.json'), recursive=True):
            try:
                d = json.load(open(f))
            except Exception:
                continue
            zh.update(d)
    return en, zh


def get_named_params(msg):
    """Return unique named params like {flurry}, {brainFreeze}, preserving order."""
    seen = set()
    result = []
    for m in re.finditer(r'\{([A-Za-z_]+)\}', msg):
        name = m.group(1)
        if name.isdigit():
            continue
        if name not in seen:
            seen.add(name)
            result.append(name)
    return result


def get_tag_indices(msg):
    """Return sorted list of <n> tag indices."""
    return sorted(set(int(x) for x in re.findall(r'<(\d+)[>/]', msg)))


def get_valid_indices(en_msg):
    """
    Return the set of valid element indices for a Lingui <Trans> message.
    
    In Lingui, element indices are assigned as follows:
    - <0> <1> etc (explicit JSX tags) get their literal index
    - {NAME} (named params referencing JSX) get indices AFTER the tags
    
    Example: 'You should use your {brainFreeze} procs...'
    - Tags: [] (no explicit tags)
    - Named: ['brainFreeze'] → gets index 0
    - Valid: {0}
    
    Example: 'This cast utilized <0/> and {FINGERS}'
    - Tags: [0] (explicit <0/>)
    - Named: ['FINGERS'] → gets index 1 (next after tags)
    - Valid: {0, 1}
    """
    en_tags = get_tag_indices(en_msg)
    en_named = get_named_params(en_msg)
    
    indices = set(en_tags)
    
    if en_named:
        offset = max(en_tags) + 1 if en_tags else 0
        for i in range(len(en_named)):
            indices.add(offset + i)
    
    return indices


def check_message(msg_id, en_msg, zh_msg):
    """
    Check if ZH placeholders match EN source.
    Returns (is_ok, explanation) tuple.
    """
    zh_tags = get_tag_indices(zh_msg)
    if not zh_tags:
        return True, "OK (no ZH tags)"

    valid = get_valid_indices(en_msg)
    
    extra = sorted(set(zh_tags) - valid)
    
    if extra:
        return False, (
            f"EN valid element indices are {sorted(valid)}, "
            f"but ZH uses tags {zh_tags}. "
            f"Invalid/extra tags: {extra}"
        )
    
    return True, "OK"


def scan(en, zh, spec_filter=None, fix=False):
    issues = []
    fixed_count = 0

    for msg_id, zh_msg in sorted(zh.items()):
        if spec_filter and not msg_id.startswith(spec_filter):
            continue

        en_msg = en.get(msg_id)
        if not en_msg:
            continue

        is_ok, explanation = check_message(msg_id, en_msg, zh_msg)
        if not is_ok:
            issues.append((msg_id, en_msg, zh_msg, explanation))

    if fix:
        print(f"\nFound {len(issues)} issues. Auto-fixing...")
        for msg_id, en_msg, zh_msg, explanation in issues:
            fixed = fix_message(msg_id, en_msg, zh_msg)
            if fixed and fixed != zh_msg:
                zh[msg_id] = fixed
                fixed_count += 1
                print(f"  ✓ {msg_id[:70]}")
            else:
                print(f"  ! {msg_id[:70]} — 需要手动修复（extra tags 比可用索引多，无法自动映射）")
        if fixed_count > 0:
            # Remove trailing whitespace from all lines in the file
            content = json.dumps(zh, ensure_ascii=False, indent=2)
            content = '\n'.join(line.rstrip() for line in content.split('\n'))
            with open(ZH_PATH, 'w') as f:
                f.write(content)
                f.write('\n')
            print(f"\nFixed {fixed_count} messages in {ZH_PATH}")
        else:
            print("No messages needed auto-fixing (may need manual fixes)")
    else:
        print(f"\n{'='*60}")
        print(f"Placeholder Check Report")
        print(f"{'='*60}")
        if spec_filter:
            print(f"Filter: {spec_filter}")
        print(f"Total issues: {len(issues)}")
        print()

        if issues:
            for i, (msg_id, en_msg, zh_msg, explanation) in enumerate(issues, 1):
                print(f"{i}. [{msg_id[:90]}]")
                print(f"   EN: {en_msg[:120]}")
                print(f"   ZH: {zh_msg[:120]}")
                print(f"   ❌ {explanation}")
                print()
        else:
            print("✅ All clean!")

    return issues


def fix_message(msg_id, en_msg, zh_msg):
    """Auto-fix a single ZH message by correcting placeholder indices."""
    valid = get_valid_indices(en_msg)
    zh_tags = get_tag_indices(zh_msg)
    extra = sorted(set(zh_tags) - valid)
    
    if not extra:
        return zh_msg
    
    # Map extra tags to valid tags that are missing in ZH
    missing = sorted(valid - set(zh_tags))
    if not missing:
        # All valid indices are already used — extra tags can't be auto-mapped
        # without losing distinction. Requires manual review.
        return zh_msg
    mapping = {}
    for old_idx in extra:
        if missing:
            new_idx = missing.pop(0)
            mapping[old_idx] = new_idx
        else:
            # Shouldn't happen given the guard above, but fallback safely
            return zh_msg
    
    if not mapping:
        return zh_msg
    
    result = zh_msg
    # Replace closing tags first, then self-closing, then opening
    for old_idx in sorted(mapping.keys(), reverse=True):
        new_idx = mapping[old_idx]
        if old_idx == new_idx:
            continue
        result = result.replace(f'</{old_idx}>', f'</{new_idx}>')
        result = result.replace(f'<{old_idx}/>', f'<{new_idx}/>')
        result = re.sub(rf'<{old_idx}>', f'<{new_idx}>', result)
    
    return result if result != zh_msg else zh_msg


def main():
    args = sys.argv[1:]
    fix = '--fix' in args
    ci = '--ci' in args
    spec_filter = None
    for a in args:
        if a.startswith('--spec='):
            spec_filter = a.split('=', 1)[1]

    if fix:
        # --fix edits messages.json only; content.json overrides need manual
        # decisions (rewrite vs. delete override), so exclude them here.
        en, zh = load_messages(merge_content=False)
    else:
        # Default and CI validate the EFFECTIVE runtime catalog, i.e. with
        # content.json overrides merged in — that's what actually renders.
        en, zh = load_messages(merge_content=True)

    if fix:
        scan(en, zh, spec_filter=spec_filter, fix=True)
        return

    issues = scan(en, zh, spec_filter=spec_filter)

    if ci:
        if issues:
            print(f"\n❌ CI FAILED: {len(issues)} placeholder issues found")
            sys.exit(1)
        else:
            print("\n✅ CI PASSED: all placeholders clean")
            sys.exit(0)


if __name__ == '__main__':
    main()