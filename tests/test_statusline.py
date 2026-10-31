"""Run extras/statusline.sh on sample rate-limit input (needs bash and jq)."""
import json
from pathlib import Path
import re
import subprocess
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'extras/statusline.sh'


def line(limits):
    out = subprocess.run(['bash', str(SCRIPT)], input=json.dumps({'rate_limits': limits}),
                         capture_output=True, text=True, check=True).stdout
    return re.sub(r'\x1b\[[0-9;]*m', '', out)


class StatusLine(unittest.TestCase):
    def test_both_windows(self):
        self.assertEqual(line({'five_hour': {'used_percentage': 18}, 'seven_day': {'used_percentage': 62}}), '5h 18% | 7d 62%')

    def test_one_window(self):
        self.assertEqual(line({'seven_day': {'used_percentage': 5}}), '7d 5%')
        self.assertEqual(line({'five_hour': {'used_percentage': 5}}), '5h 5%')


if __name__ == '__main__':
    unittest.main()
