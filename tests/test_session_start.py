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
        shutil.copytree(ROOT / 'extras', self.plugin / 'extras')
        self.project = self.root / 'project with spaces'
        self.project.mkdir()
        # The current status line is installed in the fake home, so only the tests that change it see the note.
        self.home = self.root / 'home'
        (self.home / '.claude').mkdir(parents=True)
        shutil.copy(ROOT / 'extras/statusline.sh', self.home / '.claude/statusline.sh')
        self.block = (ROOT / 'skills/lean-and-mean/operating-mode.md').read_text()
        self.command = json.loads((self.plugin / 'hooks/hooks.json').read_text())['hooks']['SessionStart'][0]['hooks'][0]['command']

    def run_hook(self, host, cwd=None, **extra):
        env = os.environ.copy()
        for key in ('PLUGIN_ROOT', 'CLAUDE_PLUGIN_ROOT', 'CLAUDE_PROJECT_DIR'):
            env.pop(key, None)
        env['HOME'] = str(self.home)
        env['CLAUDE_PLUGIN_ROOT'] = str(self.plugin)
        if host == 'codex':
            env['PLUGIN_ROOT'] = str(self.plugin)
            # A stale inherited Claude directory must not control Codex's target.
            env['CLAUDE_PROJECT_DIR'] = str(self.root / 'wrong')
        else:
            env['CLAUDE_PROJECT_DIR'] = str(self.project)
        env.update(extra)
        result = subprocess.run(['sh', '-c', self.command], cwd=cwd or self.project,
                                env=env, input='{}', text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr, '')
        return result.stdout

    def test_review_conditions_for_both_hosts(self):
        path = self.project / 'AGENTS.md'
        (self.project / 'CLAUDE.md').write_text('@AGENTS.md\n')
        cases = [
            (None, 'Not in'),
            ('# Project\n', 'Not in'),
            (self.block + '\n## Rules\n', ''),
            (self.block.replace('Lean and mean.', 'Old mode.') + '\n## Rules\n', 'out of date'),
            (self.block + '\n## Rules\n' + 'line\n' * 251, 'over the 250 cap'),
            (self.block + '\n## Rules\n<!-- lean-and-mean: review -->\n', 'flagged a review'),
        ]
        for host in ('claude', 'codex'):
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
                        self.assertIn('AGENTS.md', output)
                    else:
                        self.assertEqual(output, '')
                    self.assertEqual(path.read_bytes() if path.exists() else None, before)

    def test_claude_requires_stub(self):
        (self.project / 'AGENTS.md').write_text(self.block)
        self.assertIn('not the @AGENTS.md stub', self.run_hook('claude'))
        (self.project / 'CLAUDE.md').write_text(self.block)
        self.assertIn('not the @AGENTS.md stub', self.run_hook('claude'))
        (self.project / 'CLAUDE.md').write_text('@AGENTS.md\n')
        self.assertEqual(self.run_hook('claude'), '')

    def test_claude_3x_project_migrates(self):
        (self.project / 'CLAUDE.md').write_text(self.block + '\n## Rules\n')
        output = self.run_hook('claude')
        self.assertIn('needs the full pass', output)
        self.assertIn('then re-read AGENTS.md', output)
        self.assertNotIn('Not in', output)
        self.assertNotIn('Lean and mean.', output)

    def test_codex_ignores_claude_file(self):
        (self.project / 'AGENTS.md').write_text(self.block)
        (self.project / 'CLAUDE.md').write_text(self.block)
        self.assertEqual(self.run_hook('codex'), '')

    def test_codex_subdirectory_uses_git_root(self):
        subprocess.run(['git', 'init', '-q', str(self.project)], check=True)
        nested = self.project / 'nested'
        nested.mkdir()
        (self.project / 'AGENTS.md').write_text(self.block)
        self.assertEqual(self.run_hook('codex', nested), '')

    def test_claude_uses_project_dir_from_another_cwd(self):
        (self.project / 'AGENTS.md').write_text(self.block)
        (self.project / 'CLAUDE.md').write_text('@AGENTS.md\n')
        self.assertEqual(self.run_hook('claude', self.root), '')

    def test_statusline_note(self):
        (self.project / 'AGENTS.md').write_text(self.block)
        (self.project / 'CLAUDE.md').write_text('@AGENTS.md\n')
        installed = self.home / '.claude/statusline.sh'
        installed.write_text('#!/usr/bin/env bash\n# lean-and-mean statusline 0\n')
        output = self.run_hook('claude')
        self.assertIn('not the current extras version', output)
        self.assertIn('/lean-and-mean:statusline', output)
        installed.unlink()
        self.assertIn('statusline.sh is missing', self.run_hook('claude'))
        self.assertEqual(self.run_hook('codex'), '')
        shutil.rmtree(self.plugin / 'extras')
        self.assertEqual(self.run_hook('claude'), '')

    def test_previous_release_project_gets_the_pass(self):
        # 5.6 layout: old prose line, separate Todo and Conventions sections.
        old = self.block.replace(self.block.split('\n\n')[1], 'Prose: ~80% ASD-STE100 — one idea per sentence.')
        (self.project / 'AGENTS.md').write_text(old + '\n## Conventions\n- x\n\n## Next\nShip.\n\n## Todo\n- P2 — y\n')
        (self.project / 'CLAUDE.md').write_text('@AGENTS.md\n')
        self.assertIn('Operating Mode block is out of date', self.run_hook('claude'))
        self.assertIn('Operating Mode block is out of date', self.run_hook('codex'))


if __name__ == '__main__':
    unittest.main()
