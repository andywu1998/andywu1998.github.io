(function() {
  var app = document.querySelector(".reader-app");
  if (!app) {
    return;
  }

  var state = {
    posts: [],
    postById: {},
    activeId: "",
    tabs: [],
    activeView: "search"
  };

  var elements = {
    viewButtons: Array.prototype.slice.call(document.querySelectorAll(".reader-view-button")),
    viewPanels: Array.prototype.slice.call(document.querySelectorAll(".reader-view")),
    searchInput: document.getElementById("reader-search-input"),
    searchCount: document.getElementById("reader-search-count"),
    searchResults: document.getElementById("reader-search-results"),
    tagTree: document.getElementById("reader-tag-tree"),
    timelineTree: document.getElementById("reader-timeline-tree"),
    tabs: document.getElementById("reader-tabs"),
    code: document.getElementById("reader-code"),
    activePath: document.getElementById("reader-active-path"),
    originalLink: document.getElementById("reader-original-link")
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(value) {
    var match = String(value || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!match) {
      return "";
    }
    return match[1] + "-" + match[2].padStart(2, "0") + "-" + match[3].padStart(2, "0");
  }

  function shortDate(value) {
    var formatted = formatDate(value);
    return formatted ? formatted.slice(5) : "";
  }

  function setView(view) {
    state.activeView = view;
    elements.viewButtons.forEach(function(button) {
      button.classList.toggle("is-active", button.getAttribute("data-view") === view);
    });
    elements.viewPanels.forEach(function(panel) {
      panel.classList.toggle("is-active", panel.getAttribute("data-view-panel") === view);
    });
    if (view === "search" && elements.searchInput) {
      elements.searchInput.focus();
    }
  }

  function buildFileButton(post, meta) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "reader-file";
    button.setAttribute("data-post-id", post.id);
    button.title = post.title;
    button.innerHTML =
      '<span class="reader-file-icon">◆</span>' +
      '<span class="reader-file-name">' + escapeHtml(post.title) + "</span>" +
      (meta ? '<span class="reader-file-meta">' + escapeHtml(meta) + "</span>" : "");
    button.addEventListener("click", function() {
      openPost(post.id);
    });
    return button;
  }

  function buildFolder(title, posts, openByDefault, metaFormatter) {
    var folder = document.createElement("div");
    folder.className = "reader-folder" + (openByDefault ? " is-open" : "");

    var titleButton = document.createElement("button");
    titleButton.type = "button";
    titleButton.className = "reader-folder-title";
    titleButton.innerHTML =
      '<span class="reader-folder-caret">' + (openByDefault ? "▾" : "▸") + "</span>" +
      '<span>' + escapeHtml(title) + "</span>" +
      '<span class="reader-folder-count">' + posts.length + "</span>";

    var children = document.createElement("div");
    children.className = "reader-folder-children";

    posts.forEach(function(post) {
      children.appendChild(buildFileButton(post, metaFormatter ? metaFormatter(post) : ""));
    });

    titleButton.addEventListener("click", function() {
      folder.classList.toggle("is-open");
      titleButton.querySelector(".reader-folder-caret").textContent = folder.classList.contains("is-open") ? "▾" : "▸";
    });

    folder.appendChild(titleButton);
    folder.appendChild(children);
    return folder;
  }

  function renderTagTree() {
    var tags = {};
    state.posts.forEach(function(post) {
      var postTags = post.tags.length ? post.tags : ["untagged"];
      postTags.forEach(function(tag) {
        if (!tags[tag]) {
          tags[tag] = [];
        }
        tags[tag].push(post);
      });
    });

    var names = Object.keys(tags).sort(function(a, b) {
      return a.localeCompare(b, "zh-Hans-CN");
    });

    elements.tagTree.innerHTML = "";
    names.forEach(function(name, index) {
      elements.tagTree.appendChild(buildFolder(name, tags[name], index < 3, shortDate));
    });
  }

  function renderTimelineTree() {
    var years = {};
    state.posts.forEach(function(post) {
      var year = formatDate(post.date).slice(0, 4) || "unknown";
      if (!years[year]) {
        years[year] = [];
      }
      years[year].push(post);
    });

    elements.timelineTree.innerHTML = "";
    Object.keys(years).sort().reverse().forEach(function(year, index) {
      elements.timelineTree.appendChild(buildFolder(year, years[year], index < 2, shortDate));
    });
  }

  function searchPosts(query) {
    var normalized = query.trim().toLowerCase();
    if (!normalized) {
      return state.posts.slice(0, 20);
    }

    return state.posts.filter(function(post) {
      var haystack = [
        post.title,
        post.subtitle,
        post.date,
        post.tags.join(" "),
        post.sourcePath,
        post.searchText
      ].join("\n").toLowerCase();
      return haystack.indexOf(normalized) !== -1;
    }).slice(0, 80);
  }

  function renderSearch() {
    var query = elements.searchInput.value || "";
    var results = searchPosts(query);
    elements.searchResults.innerHTML = "";
    elements.searchCount.textContent = results.length + (query.trim() ? " results" : " recent files");

    if (!results.length) {
      elements.searchResults.innerHTML = '<div class="reader-empty">No results</div>';
      return;
    }

    results.forEach(function(post) {
      elements.searchResults.appendChild(buildFileButton(post, shortDate(post.date)));
    });
    updateActiveMarkers();
  }

  function openPost(id) {
    if (!state.postById[id]) {
      return;
    }

    if (state.tabs.indexOf(id) === -1) {
      state.tabs.push(id);
    }

    state.activeId = id;
    window.location.hash = encodeURIComponent(id);
    saveSession();
    renderTabs();
    renderActivePost();
    updateActiveMarkers();
  }

  function closeTab(id) {
    var index = state.tabs.indexOf(id);
    if (index === -1) {
      return;
    }

    state.tabs.splice(index, 1);
    if (state.activeId === id) {
      var nextId = state.tabs[index] || state.tabs[index - 1] || "";
      state.activeId = nextId;
      if (nextId) {
        window.location.hash = encodeURIComponent(nextId);
      } else {
        history.replaceState(null, "", window.location.pathname);
      }
    }

    saveSession();
    renderTabs();
    renderActivePost();
    updateActiveMarkers();
  }

  function renderTabs() {
    elements.tabs.innerHTML = "";

    state.tabs.forEach(function(id) {
      var post = state.postById[id];
      if (!post) {
        return;
      }

      var tab = document.createElement("button");
      tab.type = "button";
      tab.className = "reader-tab" + (id === state.activeId ? " is-active" : "");
      tab.innerHTML =
        '<span class="reader-tab-title">' + escapeHtml(post.title) + "</span>" +
        '<span class="reader-tab-close" aria-label="Close tab">×</span>';

      tab.addEventListener("click", function(event) {
        if (event.target.classList.contains("reader-tab-close")) {
          closeTab(id);
          return;
        }
        openPost(id);
      });

      elements.tabs.appendChild(tab);
    });
  }

  function lineClass(line, inFence) {
    if (/^---\s*$/.test(line) || inFence.frontMatter) {
      return "is-front-matter";
    }
    if (/^```/.test(line)) {
      return "is-code-fence";
    }
    if (/^\s*#/.test(line)) {
      return "is-heading";
    }
    if (/^\s*>/.test(line)) {
      return "is-quote";
    }
    if (/^\s*(-|\*|\d+\.)\s+/.test(line)) {
      return "is-list";
    }
    if (/`[^`]+`/.test(line)) {
      return "is-inline-code";
    }
    return "";
  }

  function renderMarkdown(markdown) {
    var lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    var html = [];
    var fenceOpen = false;
    var frontMatterFenceCount = 0;

    lines.forEach(function(line, index) {
      if (/^---\s*$/.test(line) && frontMatterFenceCount < 2) {
        frontMatterFenceCount += 1;
      }

      var marker = {
        frontMatter: frontMatterFenceCount === 1 && !/^---\s*$/.test(line)
      };
      var cls = lineClass(line, marker);
      if (fenceOpen) {
        cls = "is-code-fence";
      }
      if (/^```/.test(line)) {
        fenceOpen = !fenceOpen;
      }

      html.push(
        '<div class="reader-line">' +
          '<span class="reader-line-number">' + (index + 1) + "</span>" +
          '<span class="reader-line-content ' + cls + '">' + escapeHtml(line || " ") + "</span>" +
        "</div>"
      );
    });

    return html.join("");
  }

  function inlineMarkdown(node) {
    var result = "";
    Array.prototype.slice.call(node.childNodes).forEach(function(child) {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent;
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      var tag = child.tagName.toLowerCase();
      var content = inlineMarkdown(child);
      if (tag === "strong" || tag === "b") {
        result += "**" + content + "**";
      } else if (tag === "em" || tag === "i") {
        result += "*" + content + "*";
      } else if (tag === "code") {
        result += "`" + child.textContent + "`";
      } else if (tag === "a") {
        result += "[" + content + "](" + child.getAttribute("href") + ")";
      } else if (tag === "img") {
        result += "![" + (child.getAttribute("alt") || "") + "](" + child.getAttribute("src") + ")";
      } else if (tag === "br") {
        result += "\n";
      } else {
        result += content;
      }
    });
    return result;
  }

  function tableToMarkdown(table) {
    var rows = Array.prototype.slice.call(table.querySelectorAll("tr")).map(function(row) {
      return Array.prototype.slice.call(row.children).map(function(cell) {
        return inlineMarkdown(cell).replace(/\s+/g, " ").trim();
      });
    }).filter(function(row) {
      return row.length > 0;
    });

    if (!rows.length) {
      return "";
    }

    var header = rows[0];
    var separator = header.map(function() {
      return "---";
    });
    return [header, separator].concat(rows.slice(1)).map(function(row) {
      return "| " + row.join(" | ") + " |";
    }).join("\n");
  }

  function listToMarkdown(list, depth) {
    var ordered = list.tagName.toLowerCase() === "ol";
    return Array.prototype.slice.call(list.children).filter(function(item) {
      return item.tagName && item.tagName.toLowerCase() === "li";
    }).map(function(item, index) {
      var prefix = ordered ? (index + 1) + ". " : "- ";
      var nested = [];
      Array.prototype.slice.call(item.children).forEach(function(child) {
        var tag = child.tagName.toLowerCase();
        if (tag === "ul" || tag === "ol") {
          nested.push(listToMarkdown(child, depth + 1));
        }
      });

      var clone = item.cloneNode(true);
      Array.prototype.slice.call(clone.children).forEach(function(child) {
        var tag = child.tagName.toLowerCase();
        if (tag === "ul" || tag === "ol") {
          child.remove();
        }
      });

      var line = "  ".repeat(depth) + prefix + inlineMarkdown(clone).trim();
      return [line].concat(nested).filter(Boolean).join("\n");
    }).join("\n");
  }

  function blockToMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.trim();
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    var tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      return "#".repeat(Number(tag.charAt(1))) + " " + inlineMarkdown(node).trim();
    }
    if (tag === "p") {
      return inlineMarkdown(node).trim();
    }
    if (tag === "blockquote") {
      return domToMarkdown(node).split("\n").map(function(line) {
        return line ? "> " + line : ">";
      }).join("\n");
    }
    if (tag === "pre") {
      return "```\n" + node.textContent.replace(/\n$/, "") + "\n```";
    }
    if (tag === "ul" || tag === "ol") {
      return listToMarkdown(node, 0);
    }
    if (tag === "table") {
      return tableToMarkdown(node);
    }
    if (tag === "hr") {
      return "---";
    }
    if (tag === "div" && node.hasAttribute("data-reader-frontmatter")) {
      return node.textContent.trim();
    }
    if (tag === "script" || tag === "style") {
      return "";
    }
    return domToMarkdown(node).trim() || inlineMarkdown(node).trim();
  }

  function domToMarkdown(root) {
    return Array.prototype.slice.call(root.childNodes).map(blockToMarkdown).filter(function(text) {
      return text && text.trim();
    }).join("\n\n");
  }

  function postMarkdown(post) {
    var source = document.getElementById(post.htmlId);
    if (!source) {
      return "# " + post.title + "\n\nContent not found.";
    }
    return domToMarkdown(source);
  }

  function renderActivePost() {
    var post = state.postById[state.activeId];
    if (!post) {
      elements.activePath.textContent = "reader://empty";
      elements.originalLink.style.visibility = "hidden";
      elements.code.innerHTML = '<div class="reader-loading">Select a file from Explorer</div>';
      return;
    }

    elements.activePath.textContent = post.sourcePath;
    if (post.url) {
      elements.originalLink.href = post.url;
      elements.originalLink.style.visibility = "visible";
    } else {
      elements.originalLink.style.visibility = "hidden";
    }
    elements.code.innerHTML = renderMarkdown(postMarkdown(post));
    elements.code.scrollTop = 0;
  }

  function updateActiveMarkers() {
    Array.prototype.slice.call(document.querySelectorAll(".reader-file")).forEach(function(file) {
      file.classList.toggle("is-active", file.getAttribute("data-post-id") === state.activeId);
    });
  }

  function saveSession() {
    try {
      localStorage.setItem("reader.tabs", JSON.stringify(state.tabs));
      localStorage.setItem("reader.activeId", state.activeId);
    } catch (error) {
      return;
    }
  }

  function restoreSession() {
    var hashId = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    var savedTabs = [];
    var savedActiveId = "";

    try {
      savedTabs = JSON.parse(localStorage.getItem("reader.tabs") || "[]");
      savedActiveId = localStorage.getItem("reader.activeId") || "";
    } catch (error) {
      savedTabs = [];
    }

    state.tabs = savedTabs.filter(function(id) {
      return Boolean(state.postById[id]);
    }).slice(0, 8);

    state.activeId = state.postById[hashId] ? hashId : "";
    if (!state.activeId && state.postById[savedActiveId]) {
      state.activeId = savedActiveId;
    }
    if (!state.activeId && state.posts.length) {
      state.activeId = state.posts[0].id;
    }
    if (state.activeId && state.tabs.indexOf(state.activeId) === -1) {
      state.tabs.unshift(state.activeId);
    }
  }

  function bindEvents() {
    elements.viewButtons.forEach(function(button) {
      button.addEventListener("click", function() {
        setView(button.getAttribute("data-view"));
      });
    });

    elements.searchInput.addEventListener("input", renderSearch);

    window.addEventListener("hashchange", function() {
      var id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (id && state.postById[id] && id !== state.activeId) {
        openPost(id);
      }
    });
  }

  function loadEmbeddedData() {
    var dataNode = document.getElementById("reader-posts-data");
    if (!dataNode) {
      throw new Error("Reader data not found");
    }
    return JSON.parse(dataNode.textContent);
  }

  function boot(data) {
    state.posts = data.posts || [];
    state.posts.forEach(function(post) {
      state.postById[post.id] = post;
    });

    restoreSession();
    renderTagTree();
    renderTimelineTree();
    renderSearch();
    renderTabs();
    renderActivePost();
    updateActiveMarkers();
    bindEvents();
  }

  try {
    elements.code.innerHTML = '<div class="reader-loading">Loading reader data...</div>';
    boot(loadEmbeddedData());
  } catch (error) {
    elements.activePath.textContent = "reader://error";
    elements.code.innerHTML = '<div class="reader-loading">' + escapeHtml(error.message) + "</div>";
  }
})();
