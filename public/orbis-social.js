(() => {
  const $ = (id) => document.getElementById(id);
  const api = (path, options = {}) => {
    if (typeof window.orbisApi !== "function") throw new Error("Подключение к ORBIS ещё не готово. Обнови страницу.");
    return window.orbisApi(path, options);
  };

  async function renderConversations() {
    const list = $("orbisConversationList");
    if (!list) return;
    list.textContent = "Загружаем диалоги…";
    try {
      const data = await api("/api/conversations");
      list.replaceChildren();
      if (!data.conversations?.length) {
        list.textContent = "Пока нет диалогов. Введи username участника выше.";
        return;
      }
      data.conversations.forEach((conversation) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "orbis-conversation-item";
        const name = document.createElement("strong");
        name.textContent = conversation.other?.display_name || conversation.other?.username || "Участник";
        const username = document.createElement("small");
        username.textContent = "@" + (conversation.other?.username || "user");
        const preview = document.createElement("span");
        preview.textContent = conversation.lastMessage || "Начни разговор";
        const unread = document.createElement("i");
        unread.textContent = conversation.unread ? String(conversation.unread) : "";
        button.append(name, username, preview, unread);
        button.addEventListener("click", () => openConversation(conversation.id, conversation.other));
        list.append(button);
      });
    } catch (error) {
      list.textContent = error.message;
    }
  }

  async function openConversation(id, other) {
    const panel = $("orbisChatPanel");
    if (!panel) return;
    panel.replaceChildren();

    const heading = document.createElement("div");
    heading.className = "orbis-chat-heading";
    const name = document.createElement("strong");
    name.textContent = other?.display_name || other?.username || "Диалог";
    const username = document.createElement("span");
    username.textContent = other?.username ? "@" + other.username : "Личные сообщения";
    const refresh = document.createElement("button");
    refresh.type = "button";
    refresh.className = "secondary";
    refresh.textContent = "↻";
    refresh.addEventListener("click", () => openConversation(id, other));
    heading.append(name, username, refresh);

    const messages = document.createElement("div");
    messages.className = "orbis-chat-messages";
    messages.textContent = "Загружаем сообщения…";

    const form = document.createElement("form");
    form.className = "orbis-chat-send";
    const input = document.createElement("textarea");
    input.rows = 2;
    input.maxLength = 2000;
    input.required = true;
    input.placeholder = "Напиши сообщение…";
    const send = document.createElement("button");
    send.type = "submit";
    send.className = "primary";
    send.textContent = "Отправить";
    form.append(input, send);
    panel.append(heading, messages, form);

    try {
      const data = await api("/api/conversations/" + encodeURIComponent(id) + "/messages");
      messages.replaceChildren();
      if (!data.messages?.length) {
        const empty = document.createElement("p");
        empty.textContent = "Это начало вашего диалога.";
        messages.append(empty);
      }
      (data.messages || []).forEach((message) => {
        const bubble = document.createElement("div");
        bubble.className = "orbis-message" + (message.own ? " own" : "");
        const author = document.createElement("small");
        author.textContent = message.own ? "Ты" : message.author;
        const body = document.createElement("p");
        body.textContent = message.body;
        const time = document.createElement("time");
        time.textContent = new Date(message.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
        bubble.append(author, body, time);
        messages.append(bubble);
      });
      messages.scrollTop = messages.scrollHeight;
    } catch (error) {
      messages.textContent = error.message;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const body = input.value.trim();
      if (!body) return;
      send.disabled = true;
      try {
        await api("/api/conversations/" + encodeURIComponent(id) + "/messages", {
          method: "POST",
          body: JSON.stringify({ body })
        });
        input.value = "";
        await openConversation(id, other);
        await renderConversations();
      } catch (error) {
        window.notify?.(error.message);
      } finally {
        send.disabled = false;
      }
    });
  }

  async function showMessages() {
    const form = $("orbisNewDmForm");
    const note = $("orbisDmNote");
    if (form && !form.dataset.bound) {
      form.dataset.bound = "1";
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const username = new FormData(form).get("username");
        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        if (note) note.textContent = "Открываем диалог…";
        try {
          const data = await api("/api/conversations", {
            method: "POST",
            body: JSON.stringify({ username })
          });
          await renderConversations();
          await openConversation(data.conversationId, data.other);
          form.reset();
          if (note) note.textContent = "Диалог открыт.";
        } catch (error) {
          if (note) note.textContent = error.message;
        } finally {
          button.disabled = false;
        }
      });
    }
    await renderConversations();
  }

  async function showNotifications() {
    const list = $("orbisNotificationsList");
    if (!list) return;
    try {
      const data = await api("/api/notifications");
      const count = $("orbisUnreadCount");
      if (count) count.textContent = "Непрочитанных: " + (data.unread || 0);
      list.replaceChildren();
      if (!data.notifications?.length) list.textContent = "Пока нет уведомлений.";
      (data.notifications || []).forEach((notification) => {
        const row = document.createElement("article");
        row.className = "orbis-notification" + (!notification.read_at ? " unread" : "");
        const actor = document.createElement("strong");
        actor.textContent = notification.actor?.display_name || notification.actor?.username || "ORBIS";
        const body = document.createElement("p");
        body.textContent = notification.body || "Новое событие в ORBIS.";
        const time = document.createElement("time");
        time.textContent = new Date(notification.created_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        row.append(actor, body, time);
        if (!notification.read_at) {
          const mark = document.createElement("button");
          mark.type = "button";
          mark.className = "secondary";
          mark.textContent = "Прочитано";
          mark.addEventListener("click", async () => {
            await api("/api/notifications/read", { method: "POST", body: JSON.stringify({ id: notification.id }) });
            showNotifications();
          });
          row.append(mark);
        }
        list.append(row);
      });
    } catch (error) {
      list.textContent = error.message;
    }

    const readAll = $("orbisReadAll");
    if (readAll && !readAll.dataset.bound) {
      readAll.dataset.bound = "1";
      readAll.addEventListener("click", async () => {
        readAll.disabled = true;
        try {
          await api("/api/notifications/read", { method: "POST", body: "{}" });
          await showNotifications();
        } catch (error) {
          window.notify?.(error.message);
        } finally {
          readAll.disabled = false;
        }
      });
    }
  }

  async function showClans() {
    const list = $("orbisClansList");
    if (!list) return;
    try {
      const data = await api("/api/clans");
      list.replaceChildren();
      (data.clans || []).forEach((clan) => {
        const card = document.createElement("article");
        card.className = "orbis-clan-card";
        const title = document.createElement("h3");
        title.textContent = clan.name;
        const description = document.createElement("p");
        description.textContent = clan.description || "Описание пока не добавлено.";
        const count = document.createElement("small");
        count.textContent = clan.memberCount + " участников";
        const action = document.createElement("button");
        action.type = "button";
        action.className = "primary";
        action.textContent = clan.isMember ? (clan.role === "owner" ? "Ты создатель" : "Покинуть клан") : (data.myClan ? "Ты уже в другом клане" : "Вступить");
        action.disabled = Boolean(data.myClan && !clan.isMember) || clan.role === "owner";
        if (clan.isMember && clan.role !== "owner") {
          action.addEventListener("click", async () => {
            try {
              await api("/api/clans/" + encodeURIComponent(clan.slug) + "/leave", { method: "POST", body: "{}" });
              showClans();
            } catch (error) {
              window.notify?.(error.message);
            }
          });
        } else if (!clan.isMember && !data.myClan) {
          action.addEventListener("click", async () => {
            try {
              await api("/api/clans/" + encodeURIComponent(clan.slug) + "/join", { method: "POST", body: "{}" });
              showClans();
            } catch (error) {
              window.notify?.(error.message);
            }
          });
        }
        card.append(title, description, count, action);
        list.append(card);
      });
      if (!data.clans?.length) list.textContent = "Пока нет кланов. Создай первый.";

      const form = $("orbisClanForm");
      const note = $("orbisClanNote");
      if (form) {
        form.hidden = Boolean(data.myClan);
        if (data.myClan && note) note.textContent = "Ты уже состоишь в одном клане. Сначала выйди из текущего.";
      }
      if (form && !form.dataset.bound) {
        form.dataset.bound = "1";
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const fields = new FormData(form);
          const button = form.querySelector('[type="submit"]');
          button.disabled = true;
          try {
            await api("/api/clans", {
              method: "POST",
              body: JSON.stringify({ name: fields.get("name"), description: fields.get("description") })
            });
            form.reset();
            await showClans();
          } catch (error) {
            if (note) note.textContent = error.message;
          } finally {
            button.disabled = false;
          }
        });
      }
    } catch (error) {
      list.textContent = error.message;
    }
  }

  window.orbisShowMessages = showMessages;
  window.orbisShowNotifications = showNotifications;
  window.orbisShowClans = showClans;
})();
