import json
import re
import html
import os

transcript_path = '/home/saptgiri7/.gemini/antigravity-ide/brain/322319bf-6acc-4ddd-873b-6d54b83ec04e/.system_generated/logs/transcript.jsonl'

turns = []
current_turn = None

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        d = json.loads(line)
        stype = d.get('type')
        content = d.get('content', '')
        
        if stype == 'USER_INPUT':
            m = re.search(r'<USER_REQUEST>(.*?)</USER_REQUEST>', content, re.DOTALL)
            user_text = m.group(1).strip() if m else content.strip()
            
            m_time = re.search(r'The current local time is:\s*([0-9T:+-]+)', content)
            time_str = m_time.group(1) if m_time else ''
            
            current_turn = {
                'id': len(turns) + 1,
                'user': user_text,
                'time': time_str,
                'assistant': [],
                'tool_count': 0
            }
            turns.append(current_turn)
        elif stype == 'PLANNER_RESPONSE' and content:
            if current_turn:
                current_turn['assistant'].append(content)
        elif current_turn and stype not in ['USER_INPUT', 'PLANNER_RESPONSE']:
            current_turn['tool_count'] += 1

# 1. Generate Markdown file
md_lines = [
    '# Previous Conversation Transcript (Session `322319bf-6acc-4ddd-873b-6d54b83ec04e`)',
    '',
    '> **Session Started**: September 20, 2026 | **Last Active**: September 21, 2026, 23:18',
    '> **Total Turns**: ' + str(len(turns)) + ' user prompts, 3,407 execution steps',
    '',
    '---',
    ''
]

for t in turns:
    time_badge = f' *({t["time"]})*' if t["time"] else ''
    md_lines.append(f'## 👤 Turn {t["id"]}: User Prompt{time_badge}')
    md_lines.append('')
    md_lines.append('> ' + '\n> '.join(t['user'].split('\n')))
    md_lines.append('')
    
    if t['assistant']:
        for a_idx, reply in enumerate(t['assistant']):
            sub_label = f' (Part {a_idx + 1})' if len(t['assistant']) > 1 else ''
            md_lines.append(f'### 🤖 Assistant Response{sub_label}')
            md_lines.append('')
            md_lines.append(reply)
            md_lines.append('')
    else:
        md_lines.append(f'*[Executed {t["tool_count"]} background operations / modifications]*')
        md_lines.append('')
    
    md_lines.append('---')
    md_lines.append('')

os.makedirs('/home/saptgiri7/Desktop/rummy/docs', exist_ok=True)
md_path = '/home/saptgiri7/Desktop/rummy/docs/previous-conversation.md'
with open(md_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(md_lines))

print(f'Wrote {md_path} ({len(md_lines)} lines)')

# 2. Generate Interactive HTML Viewer
html_content = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Conversation Viewer - Session 322319bf</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<style>
  :root {
    --bg-main: #0B0F19;
    --bg-sidebar: #0F172A;
    --bg-card: #1E293B;
    --bg-user: #1E3A8A;
    --border-color: #334155;
    --text-primary: #F8FAFC;
    --text-secondary: #94A3B8;
    --accent: #38BDF8;
    --accent-glow: rgba(56, 189, 248, 0.15);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg-main);
    color: var(--text-primary);
    height: 100vh;
    display: flex;
    overflow: hidden;
  }
  #sidebar {
    width: 340px;
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    height: 100%;
    flex-shrink: 0;
  }
  #sidebar-header {
    padding: 18px;
    border-bottom: 1px solid var(--border-color);
  }
  #sidebar-header h2 {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  #sidebar-header p {
    font-size: 0.78rem;
    color: var(--text-secondary);
    margin-top: 4px;
  }
  #search-box {
    margin-top: 12px;
    width: 100%;
    padding: 8px 12px;
    background: var(--bg-main);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 0.85rem;
    outline: none;
  }
  #search-box:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  #turn-list {
    overflow-y: auto;
    flex: 1;
    padding: 8px;
  }
  .turn-nav-item {
    padding: 10px 12px;
    border-radius: 6px;
    cursor: pointer;
    margin-bottom: 4px;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }
  .turn-nav-item:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--border-color);
  }
  .turn-nav-item.active {
    background: var(--bg-card);
    border-color: var(--accent);
  }
  .turn-badge {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 3px;
    display: flex;
    justify-content: space-between;
  }
  .turn-preview {
    font-size: 0.82rem;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  #main-content {
    flex: 1;
    overflow-y: auto;
    padding: 32px 48px;
    scroll-behavior: smooth;
  }
  .chat-turn {
    margin-bottom: 48px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 32px;
  }
  .user-bubble {
    background: var(--bg-user);
    border: 1px solid #2563EB;
    border-radius: 12px;
    padding: 18px 24px;
    margin-bottom: 24px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  .user-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    font-weight: 600;
    color: #93C5FD;
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .user-text {
    font-size: 0.95rem;
    line-height: 1.6;
    white-space: pre-wrap;
    font-family: inherit;
  }
  .assistant-bubble {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 20px;
    line-height: 1.7;
    font-size: 0.95rem;
  }
  .assistant-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--accent);
    margin-bottom: 16px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .markdown-body pre {
    background: #090D16;
    border: 1px solid #1E293B;
    border-radius: 8px;
    padding: 16px;
    overflow-x: auto;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.88rem;
    margin: 16px 0;
  }
  .markdown-body code {
    font-family: 'JetBrains Mono', monospace;
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.88rem;
  }
  .markdown-body pre code {
    background: transparent;
    padding: 0;
  }
  .markdown-body h1, .markdown-body h2, .markdown-body h3 {
    margin-top: 24px;
    margin-bottom: 12px;
    color: var(--text-primary);
  }
  .markdown-body ul, .markdown-body ol {
    margin-left: 24px;
    margin-bottom: 16px;
  }
  .markdown-body li {
    margin-bottom: 6px;
  }
  .markdown-body hr {
    border: 0;
    border-top: 1px solid var(--border-color);
    margin: 20px 0;
  }
  .tool-pill {
    display: inline-block;
    background: rgba(148, 163, 184, 0.1);
    color: var(--text-secondary);
    font-size: 0.75rem;
    padding: 4px 10px;
    border-radius: 12px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    margin-top: 12px;
  }
</style>
</head>
<body>

<div id="sidebar">
  <div id="sidebar-header">
    <h2>💬 Past Chat Viewer</h2>
    <p>Session: <code>322319bf...</code> (37 Prompts)</p>
    <input type="text" id="search-box" placeholder="Search prompts or responses..." oninput="filterTurns()">
  </div>
  <div id="turn-list"></div>
</div>

<div id="main-content"></div>

<script>
const turnsData = """ + json.dumps(turns) + """;

const turnListEl = document.getElementById('turn-list');
const mainContentEl = document.getElementById('main-content');

function renderNav() {
  turnListEl.innerHTML = '';
  turnsData.forEach((t, i) => {
    const item = document.createElement('div');
    item.className = 'turn-nav-item';
    item.id = 'nav-item-' + t.id;
    item.onclick = () => scrollToTurn(t.id);
    
    const badge = document.createElement('div');
    badge.className = 'turn-badge';
    badge.innerHTML = `<span>TURN ${t.id}</span><span>${t.time ? t.time.slice(11, 16) : ''}</span>`;
    
    const preview = document.createElement('div');
    preview.className = 'turn-preview';
    preview.innerText = t.user.slice(0, 60) + (t.user.length > 60 ? '...' : '');
    
    item.appendChild(badge);
    item.appendChild(preview);
    turnListEl.appendChild(item);
  });
}

function renderContent() {
  mainContentEl.innerHTML = '';
  turnsData.forEach((t) => {
    const section = document.createElement('div');
    section.className = 'chat-turn';
    section.id = 'turn-' + t.id;
    
    // User Bubble
    const userBubble = document.createElement('div');
    userBubble.className = 'user-bubble';
    userBubble.innerHTML = `
      <div class="user-header">
        <span>👤 User Prompt (Turn ${t.id})</span>
        <span>${t.time || ''}</span>
      </div>
      <div class="user-text">${escapeHtml(t.user)}</div>
    `;
    section.appendChild(userBubble);
    
    // Assistant Replies
    if (t.assistant && t.assistant.length > 0) {
      t.assistant.forEach((reply, rIdx) => {
        const asstBubble = document.createElement('div');
        asstBubble.className = 'assistant-bubble markdown-body';
        const label = t.assistant.length > 1 ? ` (Part ${rIdx + 1})` : '';
        asstBubble.innerHTML = `
          <div class="assistant-header">🤖 Antigravity Assistant${label}</div>
          <div>${marked.parse(reply)}</div>
        `;
        section.appendChild(asstBubble);
      });
    } else {
      const toolNote = document.createElement('div');
      toolNote.className = 'tool-pill';
      toolNote.innerText = `⚙️ Executed ${t.tool_count} code actions & background commands`;
      section.appendChild(toolNote);
    }
    
    mainContentEl.appendChild(section);
  });
}

function scrollToTurn(id) {
  document.querySelectorAll('.turn-nav-item').forEach(el => el.classList.remove('active'));
  const navItem = document.getElementById('nav-item-' + id);
  if (navItem) navItem.classList.add('active');
  
  const el = document.getElementById('turn-' + id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function filterTurns() {
  const query = document.getElementById('search-box').value.toLowerCase();
  turnsData.forEach(t => {
    const navItem = document.getElementById('nav-item-' + t.id);
    const text = (t.user + ' ' + (t.assistant || []).join(' ')).toLowerCase();
    if (text.includes(query)) {
      navItem.style.display = 'block';
    } else {
      navItem.style.display = 'none';
    }
  });
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

renderNav();
renderContent();
</script>
</body>
</html>
"""

html_path = '/home/saptgiri7/Desktop/rummy/docs/previous-conversation-viewer.html'
with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html_content)

print(f'Wrote {html_path} ({len(html_content)} bytes)')
