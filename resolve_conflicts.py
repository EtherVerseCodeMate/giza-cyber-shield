#!/usr/bin/env python3
"""
Automatic Git Merge Conflict Resolver
Resolves conflicts by keeping the newer version (after =======)
"""

import sys

def resolve_conflicts(filepath, keep='theirs'):
    """
    Resolve git merge conflicts in a file.

    Args:
        filepath: Path to file with conflicts
        keep: 'ours' (HEAD) or 'theirs' (incoming)
    """
    print(f"Resolving conflicts in: {filepath}")

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"ERROR: Could not read {filepath}: {e}")
        return False

    # Count conflicts before
    conflicts_before = content.count('<<<<<<<')
    print(f"  Found {conflicts_before} conflict markers")

    if conflicts_before == 0:
        print("  No conflicts found - file already resolved")
        return True

    # Resolve conflicts
    lines = content.split('\n')
    resolved_lines = []
    in_conflict = False
    conflict_section = 'none'

    for line in lines:
        if line.startswith('<<<<<<< '):
            # Start of conflict
            in_conflict = True
            conflict_section = 'ours' if keep == 'ours' else 'skip'
            continue
        elif line.startswith('======= '):
            # Middle of conflict
            conflict_section = 'theirs' if keep == 'theirs' else 'skip'
            continue
        elif line.startswith('>>>>>>> '):
            # End of conflict
            in_conflict = False
            conflict_section = 'none'
            continue

        # Keep lines based on which section we want
        if not in_conflict:
            resolved_lines.append(line)
        elif conflict_section == keep:
            resolved_lines.append(line)
        # Skip lines in the section we don't want

    resolved_content = '\n'.join(resolved_lines)

    # Verify conflicts are resolved
    conflicts_after = resolved_content.count('<<<<<<<')

    if conflicts_after > 0:
        print(f"  WARNING: Still has {conflicts_after} conflicts after resolution!")
        return False

    # Write resolved content
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(resolved_content)
        print(f"  [OK] Resolved {conflicts_before} conflicts")
        return True
    except Exception as e:
        print(f"  ERROR: Could not write {filepath}: {e}")
        return False

if __name__ == '__main__':
    files_to_resolve = [
        r'cmd\sonar\main.go',
        r'pkg\audit\schema.go'
    ]

    print("=" * 70)
    print("Git Merge Conflict Auto-Resolver")
    print("Strategy: Keep THEIRS (newer NUCLEAR-GRADE version)")
    print("=" * 70)
    print()

    success_count = 0
    for filepath in files_to_resolve:
        if resolve_conflicts(filepath, keep='theirs'):
            success_count += 1
        print()

    print("=" * 70)
    if success_count == len(files_to_resolve):
        print(f"[SUCCESS] Resolved all {success_count} files")
        print()
        print("Next step: Run deploy.ps1 again to rebuild")
        sys.exit(0)
    else:
        print(f"[PARTIAL] Resolved {success_count}/{len(files_to_resolve)} files")
        sys.exit(1)
