import re

with open('/Users/gafardgnane/Downloads/icc-webradio-app/src/components/BibleReader.tsx', 'utf8') as f:
    lines = f.readlines()

balance = 0
for i, line in enumerate(lines[1526-1:], 1526):
    opens = len(re.findall(r'<div(?![^>]*/>)', line))
    closes = len(re.findall(r'</div>', line))
    balance += opens
    balance -= closes
    if opens != closes:
        print(f'Line {i}: balance={balance} (+{opens}, -{closes}) | {line.strip()[:60]}')

print(f'\nFinal balance: {balance}')
