"""Exercise the installed hook command without running an agent or editing projects."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class SessionStart(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='lean and mean ')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.plugin = self.root / 'plugin with spaces'
        shutil.copytree(ROOT / 'hooks', self.plugin / 'hooks')
        shutil.copytree(ROOT / 'skills', self.plugin / 'skills')
        self.project = self.root / 'project with spaces'
        self.project.mkdir()
        self.block = (ROOT / 'skills/lean-and-mean/operating-mode.md').read_text()
        self.command = json.loads((self.plugin / 'hooks/hooks.json').read_text())['hooks']['SessionStart'][0]['hooks'][0]['command']

    def run_hook(self, host, cwd=None):
        env = os.environ.copy()
        for key in ('PLUGIN_ROOT', 'CLAUDE_PLUGIN_ROOT', 'CLAUDE_PROJECT_DIR'):
            env.pop(key, None)
        env['CLAUDE_PLUGIN_ROOT'] = str(self.plugin)
        if host == 'codex':
            env['PLUGIN_ROOT'] = str(self.plugin)
            # A stale inherited Claude directory must not control Codex's target.
            env['CLAUDE_PROJECT_DIR'] = str(self.root / 'wrong')
        else:
            env['CLAUDE_PROJECT_DIR'] = str(self.project)
        result = subprocess.run(['sh', '-c', self.command], cwd=cwd or self.project,
                                env=env, input='{}', text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr, '')
        return result.stdout

    def test_review_conditions_for_both_hosts(self):
        for host, filename in [('claude', 'CLAUDE.md'), ('codex', 'AGENTS.md')]:
            path = self.project / filename
            cases = [
                (None, 'Not in'),
                ('# Project\n', 'Not in'),
                (self.block + '\n## Rules\n', ''),
                (self.block.replace('Lean and mean.', 'Old mode.') + '\n## Rules\n', 'out of date'),
                (self.block + '\n## Rules\n' + 'line\n' * 251, 'over the 250 cap'),
                (self.block + '\n## Rules\n<!-- lean-and-mean: review -->\n', 'flagged a review'),
            ]
            for content, expected in cases:
                with self.subTest(host=host, expected=expected):
                    if content is None:
                        path.unlink(missing_ok=True)
                    else:
                        path.write_text(content)
                    before = path.read_bytes() if path.exists() else None
                    output = self.run_hook(host)
                    if expected:
                        self.assertIn(expected, output)
                        self.assertIn(filename, output)
                    else:
                        self.assertEqual(output, '')
                    self.assertEqual(path.read_bytes() if path.exists() else None, before)
            path.unlink()

    def test_codex_ignores_claude_file(self):
        (self.project / 'CLAUDE.md').write_text(self.block)
        self.assertIn('AGENTS.md', self.run_hook('codex'))

    def test_codex_override_precedence(self):
        (self.project / 'AGENTS.md').write_text(self.block)
        override = self.project / 'AGENTS.override.md'
        override.write_text('Other instructions\n')
        self.assertIn('AGENTS.override.md', self.run_hook('codex'))
        override.write_text(self.block)
        self.assertEqual(self.run_hook('codex'), '')
        override.write_text('')
        self.assertEqual(self.run_hook('codex'), '')

    def test_codex_subdirectory_uses_git_root(self):
        subprocess.run(['git', 'init', '-q', str(self.project)], check=True)
        nested = self.project / 'nested'
        nested.mkdir()
        (self.project / 'AGENTS.md').write_text(self.block)
        self.assertEqual(self.run_hook('codex', nested), '')

    def test_claude_uses_project_dir_from_another_cwd(self):
        (self.project / 'CLAUDE.md').write_text(self.block)
        self.assertEqual(self.run_hook('claude', self.root), '')


if __name__ == '__main__':
    unittest.main()
