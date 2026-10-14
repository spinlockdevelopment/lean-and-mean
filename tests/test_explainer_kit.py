"""Check the explainer kit's pure parsers through node; the page look is checked by rendering docs/explainer/index.html."""
import json
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / 'docs/explainer/v1/kit.js'


def kit(expr):
    js = f'const k = require({json.dumps(str(KIT))}); process.stdout.write(JSON.stringify({expr}))'
    return json.loads(subprocess.run(['node', '-e', js], capture_output=True, text=True, check=True).stdout)


@unittest.skipUnless(shutil.which('node'), 'node not installed')
class ExplainerKit(unittest.TestCase):
    def test_style(self):
        self.assertEqual(kit('k.parseStyle("dark airy #14b8a6")'), {'theme': 'dark', 'density': 'airy', 'accent': '#14b8a6'})
        self.assertEqual(kit('k.parseStyle("")'), {'theme': 'auto', 'density': 'dense', 'accent': None})

    def test_frontmatter_and_escape(self):
        r = kit(r'k.frontmatter(k.dedent("  ---\n  date: 2026-10-14T09:00:00+02:00\n  ---\n  # T\n  <\\/xmp>\n"))')
        self.assertEqual(r['meta'], {'date': '2026-10-14T09:00:00+02:00'})
        self.assertEqual(r['body'], '# T\n</xmp>\n')

    def test_items_skip_nested_fences(self):
        r = kit(r'k.items("intro\n# A\n```sh\n# not an item\n```\n# B\nb")')
        self.assertEqual([i['title'] for i in r], ['A', 'B'])
        self.assertIn('# not an item', r[0]['body'])

    def test_grid_divides_count(self):
        self.assertEqual(kit('[1,2,3,4,5,6,7,8,9].map(k.gridCols)'), [1, 2, 3, 2, 3, 3, 3, 4, 3])

    def test_tree_connectors(self):
        r = kit(r'k.tree("a/\n  b.js  # note\n  c/\n    d.md\ne")')
        self.assertEqual([x['prefix'] + x['name'] for x in r], ['a/', '├─ b.js', '└─ c/', '   └─ d.md', 'e'])
        self.assertEqual(r[1]['note'], 'note')

    def test_path_chips(self):
        self.assertEqual(kit('["hooks/judge.ts:12", "kit.js", "a b", "x => y", "src/"].map(k.isPath)'), [True, True, False, False, True])


if __name__ == '__main__':
    unittest.main()
