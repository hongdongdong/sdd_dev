(function () {
  'use strict';

  const STORAGE_KEYS = {
    todos: 'todos',
    notes: 'notes',
    quickLinks: 'quickLinks',
  };

  function loadList(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveList(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function normalizeUrl(url) {
    const value = String(url || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    return 'https://' + value;
  }

  let todos = loadList(STORAGE_KEYS.todos);
  let notes = loadList(STORAGE_KEYS.notes);
  let quickLinks = loadList(STORAGE_KEYS.quickLinks);
  let editingNoteId = null;
  let editingLinkId = null;

  function ensureStorageKeys() {
    Object.keys(STORAGE_KEYS).forEach(function (key) {
      try {
        if (localStorage.getItem(STORAGE_KEYS[key]) === null) {
          localStorage.setItem(STORAGE_KEYS[key], '[]');
        }
      } catch {
        // 忽略无法写入的情况，读取时仍有空数组兜底
      }
    });
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setFeedback(id, message) {
    $(id).textContent = message;
  }

  function clearFeedback(id) {
    $(id).textContent = '';
  }

  function renderTodos() {
    const list = $('todo-list');
    list.textContent = '';
    todos.forEach(function (todo) {
      const li = document.createElement('li');
      li.className = 'todo-item';
      li.dataset.testid = 'todo-item';

      const label = document.createElement('label');
      label.className = 'todo-check';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.testid = 'todo-toggle';
      checkbox.checked = Boolean(todo.done);
      checkbox.addEventListener('change', function () {
        toggleTodo(todo.id);
      });

      const text = document.createElement('span');
      text.className = 'todo-text';
      text.dataset.testid = 'todo-text';
      text.textContent = todo.text;
      if (todo.done) text.classList.add('done');

      label.append(checkbox, text);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger';
      del.dataset.testid = 'todo-delete';
      del.textContent = '删除';
      del.addEventListener('click', function () {
        deleteTodo(todo.id);
      });

      li.append(label, del);
      list.append(li);
    });
  }

  function renderNotes() {
    const list = $('note-list');
    list.textContent = '';
    notes.forEach(function (note) {
      const li = document.createElement('li');
      li.className = 'note-item';
      li.dataset.testid = 'note-item';

      if (editingNoteId === note.id) {
        const textarea = document.createElement('textarea');
        textarea.className = 'note-edit-input';
        textarea.dataset.testid = 'note-edit-input';
        textarea.value = note.content;

        const actions = document.createElement('div');
        actions.className = 'item-actions';

        const save = document.createElement('button');
        save.type = 'button';
        save.dataset.testid = 'note-save';
        save.textContent = '保存';
        save.addEventListener('click', function () {
          saveNoteEdit(note.id);
        });

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'secondary';
        cancel.dataset.testid = 'note-cancel';
        cancel.textContent = '取消';
        cancel.addEventListener('click', function () {
          editingNoteId = null;
          clearFeedback('note-feedback');
          renderNotes();
        });

        actions.append(save, cancel);
        li.append(textarea, actions);
      } else {
        const body = document.createElement('div');
        body.className = 'note-content';
        body.dataset.testid = 'note-content';

        const content = document.createElement('p');
        content.className = 'note-content';
        content.textContent = note.content;

        const meta = document.createElement('time');
        meta.className = 'note-meta';
        meta.dateTime = note.updatedAt || '';
        meta.textContent = note.updatedAt ? '更新于 ' + new Date(note.updatedAt).toLocaleString() : '';

        body.append(content, meta);

        const actions = document.createElement('div');
        actions.className = 'item-actions';

        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'secondary';
        edit.dataset.testid = 'note-edit';
        edit.textContent = '编辑';
        edit.addEventListener('click', function () {
          editingNoteId = note.id;
          renderNotes();
        });

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'danger';
        del.dataset.testid = 'note-delete';
        del.textContent = '删除';
        del.addEventListener('click', function () {
          deleteNote(note.id);
        });

        actions.append(edit, del);
        li.append(body, actions);
      }

      list.append(li);
    });
  }

  function renderLinks() {
    const list = $('link-list');
    list.textContent = '';
    quickLinks.forEach(function (link) {
      const li = document.createElement('li');
      li.className = 'link-item';
      li.dataset.testid = 'link-item';

      if (editingLinkId === link.id) {
        const row = document.createElement('div');
        row.className = 'edit-row';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.dataset.testid = 'link-edit-name';
        nameInput.value = link.name;

        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.dataset.testid = 'link-edit-url';
        urlInput.value = link.url;

        row.append(nameInput, urlInput);

        const actions = document.createElement('div');
        actions.className = 'item-actions';

        const save = document.createElement('button');
        save.type = 'button';
        save.dataset.testid = 'link-save';
        save.textContent = '保存';
        save.addEventListener('click', function () {
          saveLinkEdit(link.id);
        });

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'secondary';
        cancel.dataset.testid = 'link-cancel';
        cancel.textContent = '取消';
        cancel.addEventListener('click', function () {
          editingLinkId = null;
          clearFeedback('link-feedback');
          renderLinks();
        });

        actions.append(save, cancel);
        li.append(row, actions);
      } else {
        const body = document.createElement('div');
        body.className = 'link-body';

        const anchor = document.createElement('a');
        anchor.className = 'link-open';
        anchor.dataset.testid = 'link-open';
        anchor.href = link.url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = link.name;

        const url = document.createElement('span');
        url.className = 'link-url';
        url.textContent = link.url;

        body.append(anchor, url);

        const actions = document.createElement('div');
        actions.className = 'item-actions';

        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'secondary';
        edit.dataset.testid = 'link-edit';
        edit.textContent = '编辑';
        edit.addEventListener('click', function () {
          editingLinkId = link.id;
          renderLinks();
        });

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'danger';
        del.dataset.testid = 'link-delete';
        del.textContent = '删除';
        del.addEventListener('click', function () {
          deleteLink(link.id);
        });

        actions.append(edit, del);
        li.append(body, actions);
      }

      list.append(li);
    });
  }

  function renderAll() {
    renderTodos();
    renderNotes();
    renderLinks();
  }

  function addTodo() {
    const input = $('todo-input');
    const text = input.value.trim();
    if (!text) {
      setFeedback('todo-feedback', '请输入待办内容');
      return;
    }
    todos.push({ id: makeId(), text: text, done: false });
    if (!saveList(STORAGE_KEYS.todos, todos)) {
      setFeedback('todo-feedback', '保存失败，请检查浏览器存储空间');
      return;
    }
    input.value = '';
    clearFeedback('todo-feedback');
    renderTodos();
  }

  function toggleTodo(id) {
    const todo = todos.find(function (item) {
      return item.id === id;
    });
    if (!todo) return;
    todo.done = !todo.done;
    saveList(STORAGE_KEYS.todos, todos);
    renderTodos();
  }

  function deleteTodo(id) {
    todos = todos.filter(function (item) {
      return item.id !== id;
    });
    saveList(STORAGE_KEYS.todos, todos);
    renderTodos();
  }

  function addNote() {
    const input = $('note-input');
    const content = input.value.trim();
    if (!content) {
      setFeedback('note-feedback', '请输入笔记内容');
      return;
    }
    notes.push({ id: makeId(), content: content, updatedAt: new Date().toISOString() });
    if (!saveList(STORAGE_KEYS.notes, notes)) {
      setFeedback('note-feedback', '保存失败，请检查浏览器存储空间');
      return;
    }
    input.value = '';
    clearFeedback('note-feedback');
    renderNotes();
  }

  function saveNoteEdit(id) {
    const textarea = document.querySelector('[data-testid="note-edit-input"]');
    const content = textarea ? textarea.value.trim() : '';
    if (!content) {
      setFeedback('note-feedback', '笔记内容不能为空');
      return;
    }
    const note = notes.find(function (item) {
      return item.id === id;
    });
    if (!note) return;
    note.content = content;
    note.updatedAt = new Date().toISOString();
    saveList(STORAGE_KEYS.notes, notes);
    editingNoteId = null;
    clearFeedback('note-feedback');
    renderNotes();
  }

  function deleteNote(id) {
    notes = notes.filter(function (item) {
      return item.id !== id;
    });
    saveList(STORAGE_KEYS.notes, notes);
    renderNotes();
  }

  function addLink() {
    const nameInput = $('link-name-input');
    const urlInput = $('link-url-input');
    const name = nameInput.value.trim();
    const url = normalizeUrl(urlInput.value);
    if (!name || !url) {
      setFeedback('link-feedback', '请填写链接名称和网址');
      return;
    }
    quickLinks.push({ id: makeId(), name: name, url: url });
    if (!saveList(STORAGE_KEYS.quickLinks, quickLinks)) {
      setFeedback('link-feedback', '保存失败，请检查浏览器存储空间');
      return;
    }
    nameInput.value = '';
    urlInput.value = '';
    clearFeedback('link-feedback');
    renderLinks();
  }

  function saveLinkEdit(id) {
    const nameInput = document.querySelector('[data-testid="link-edit-name"]');
    const urlInput = document.querySelector('[data-testid="link-edit-url"]');
    const name = nameInput ? nameInput.value.trim() : '';
    const url = normalizeUrl(urlInput ? urlInput.value : '');
    if (!name || !url) {
      setFeedback('link-feedback', '请填写链接名称和网址');
      return;
    }
    const link = quickLinks.find(function (item) {
      return item.id === id;
    });
    if (!link) return;
    link.name = name;
    link.url = url;
    saveList(STORAGE_KEYS.quickLinks, quickLinks);
    editingLinkId = null;
    clearFeedback('link-feedback');
    renderLinks();
  }

  function deleteLink(id) {
    quickLinks = quickLinks.filter(function (item) {
      return item.id !== id;
    });
    saveList(STORAGE_KEYS.quickLinks, quickLinks);
    renderLinks();
  }

  // ===== 研发模块：展示流水线产物（rd/artifacts.json） =====

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showArtifact(art) {
    const content = $('rd-artifact-content');
    content.hidden = false;
    content.textContent = art.content || '（无内容）';
    content.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderRd() {
    const summary = $('rd-summary');
    const list = $('rd-artifact-list');
    summary.textContent = '';
    fetch('rd/artifacts.json', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        const d = data.demand || {};
        const rows = [
          ['需求', (d.title || '—') + '（状态：' + (d.status || '—') + '）'],
          ['分支', d.branch || '—'],
          ['成本', d.cost || '—'],
        ];
        rows.forEach(function (row) {
          const p = document.createElement('p');
          p.innerHTML = '<span class="rd-label">' + row[0] + '</span>' + escapeHtml(row[1]);
          summary.appendChild(p);
        });
        [['MR', d.mr_url, 'rd-mr-link'], ['E2E 报告', d.report_url, 'rd-report-link']].forEach(function (link) {
          if (!link[1]) return;
          const a = document.createElement('a');
          a.href = link[1];
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = link[0] + ' ↗';
          a.dataset.testid = link[2];
          summary.appendChild(a);
        });

        list.textContent = '';
        (data.artifacts || []).forEach(function (art, i) {
          const li = document.createElement('li');
          li.className = 'rd-artifact-item';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = (i + 1) + '. ' + (art.title || art.name);
          btn.dataset.testid = 'rd-artifact-item';
          btn.addEventListener('click', function () {
            showArtifact(art);
          });
          li.appendChild(btn);
          list.appendChild(li);
        });
        if (!(data.artifacts || []).length) {
          const li = document.createElement('li');
          li.textContent = '暂无产物';
          list.appendChild(li);
        }
      })
      .catch(function () {
        summary.textContent = '暂无流水线产物（跑一次流水线后自动生成 rd/artifacts.json）';
      });
  }

  $('todo-form').addEventListener('submit', function (event) {
    event.preventDefault();
    addTodo();
  });

  $('note-form').addEventListener('submit', function (event) {
    event.preventDefault();
    addNote();
  });

  $('link-form').addEventListener('submit', function (event) {
    event.preventDefault();
    addLink();
  });

  ensureStorageKeys();
  renderAll();
  renderRd();
})();
