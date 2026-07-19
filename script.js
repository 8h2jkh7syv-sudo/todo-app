const todoForm = document.getElementById("todo-form");
const todoInput = document.getElementById("todo-input");
const dueDateInput = document.getElementById("due-date-input");
const todoList = document.getElementById("todo-list");
const totalCount = document.getElementById("total-count");
const completedCount = document.getElementById("completed-count");
const currentDate = document.getElementById("current-date");

const STORAGE_KEY = "todoList";
const today = new Date();
const todayDateString = getLocalDateString(today);
let draggedTodoId = null;
let editingTodoId = null;
let pointerDrag = null;
let cardTouchDrag = null;
let cardTouchTimer = null;

let todos = loadTodos();
let dataWasMigrated = false;

todos = todos.map(function (todo, index) {
  const hasOrder = Number.isFinite(Number(todo.order));
  if (!hasOrder) dataWasMigrated = true;

  return {
    id: todo.id,
    text: todo.text,
    completed: todo.completed === true,
    dueDate: typeof todo.dueDate === "string" ? todo.dueDate : "",
    createdDate: typeof todo.createdDate === "string" ? todo.createdDate : todayDateString,
    completedDate: typeof todo.completedDate === "string" ? todo.completedDate : "",
    order: hasOrder ? Number(todo.order) : index
  };
});

todos = todos.filter(function (todo) {
  if (todo.dueDate === "") return todo.createdDate >= todayDateString;
  if (todo.completed) return todo.completedDate === "" || todo.completedDate >= todayDateString;
  return todo.dueDate >= todayDateString;
});

normalizeOrders();
// 自動削除や旧データのorder補完をlocalStorageへ反映します。
saveTodos();

currentDate.textContent =
  today.getFullYear() + "/" + (today.getMonth() + 1) + "/" + today.getDate();
currentDate.dateTime = todayDateString;

renderTodos();

todoForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const text = todoInput.value.trim();
  if (text === "") return;

  todos.push({
    id: getNextId(),
    text: text,
    dueDate: dueDateInput.value,
    completed: false,
    createdDate: getLocalDateString(new Date()),
    completedDate: "",
    order: getNextOrder(false)
  });

  normalizeOrders();
  saveTodos();
  renderTodos();
  todoInput.value = "";
  dueDateInput.value = "";
  todoInput.focus();
});

function renderTodos() {
  todoList.innerHTML = "";
  totalCount.textContent = todos.filter(function (todo) { return !todo.completed; }).length;
  completedCount.textContent = todos.filter(function (todo) { return todo.completed; }).length;

  if (todos.length === 0) {
    const emptyMessage = document.createElement("li");
    emptyMessage.className = "empty-state";
    emptyMessage.textContent = "今日のタスクはありません";
    todoList.appendChild(emptyMessage);
    return;
  }

  getSortedTodos().forEach(function (todo) {
    const isEditing = String(editingTodoId) === String(todo.id);
    const listItem = document.createElement("li");
    listItem.className = "todo-item" + (todo.completed ? " completed" : "");
    if (isEditing) listItem.classList.add("editing");
    listItem.dataset.todoId = String(todo.id);
    listItem.dataset.completed = String(todo.completed);

    const dragHandle = document.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "drag-handle";
    dragHandle.draggable = !isEditing;
    dragHandle.disabled = isEditing;
    dragHandle.setAttribute("aria-label", "並び替え");
    dragHandle.title = "ドラッグして並び替え";
    dragHandle.textContent = "⋮⋮";
    addDragEvents(dragHandle, listItem, todo);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todo-checkbox";
    checkbox.checked = todo.completed;
    checkbox.disabled = isEditing;
    checkbox.setAttribute("aria-label", todo.text + "を完了にする");
    checkbox.addEventListener("change", function () {
      todo.completed = checkbox.checked;
      todo.completedDate = checkbox.checked ? getLocalDateString(new Date()) : "";
      todo.order = getNextOrder(todo.completed, todo.id);
      normalizeOrders();
      saveTodos();
      renderTodos();
    });

    const details = isEditing ? createEditForm(todo) : createTodoDetails(todo);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "edit-button";
    editButton.disabled = isEditing;
    editButton.setAttribute("aria-label", "Todoを編集");
    editButton.title = "編集";
    editButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4ZM13.5 6.5l4 4M14.8 5.2l1.4-1.4a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8l-1.4 1.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
    editButton.addEventListener("click", function () {
      editingTodoId = todo.id;
      finishDrag();
      renderTodos();
      requestAnimationFrame(function () {
        const input = todoList.querySelector('[data-todo-id="' + String(todo.id) + '"] .edit-text-input');
        if (input) {
          input.focus();
          input.select();
        }
      });
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.disabled = isEditing;
    deleteButton.setAttribute("aria-label", "Todoを削除");
    deleteButton.title = "削除";
    deleteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
    deleteButton.addEventListener("click", function () {
      todos = todos.filter(function (item) { return item.id !== todo.id; });
      normalizeOrders();
      saveTodos();
      renderTodos();
    });

    listItem.append(dragHandle, checkbox, details, editButton, deleteButton);
    todoList.appendChild(listItem);
  });
}

function createTodoDetails(todo) {
  const details = document.createElement("div");
  details.className = "todo-details";
  const titleRow = document.createElement("div");
  titleRow.className = "todo-title-row";
  const text = document.createElement("span");
  text.className = "todo-text";
  text.textContent = todo.text;
  titleRow.appendChild(text);

  if (todo.completed) {
    const badge = document.createElement("span");
    badge.className = "completed-badge";
    badge.textContent = "✓ 完了";
    titleRow.appendChild(badge);
  }
  details.appendChild(titleRow);

  if (todo.dueDate) {
    const dueDate = document.createElement("span");
    dueDate.className = "todo-due-date";
    dueDate.textContent = "期限：" + formatDueDate(todo.dueDate);
    details.appendChild(dueDate);
  }
  return details;
}

function createEditForm(todo) {
  const form = document.createElement("form");
  form.className = "edit-form";

  const textInput = document.createElement("input");
  textInput.type = "text";
  textInput.className = "edit-text-input";
  textInput.value = todo.text;
  textInput.setAttribute("aria-label", "Todo内容を編集");

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.className = "edit-date-input";
  dateInput.value = todo.dueDate;
  dateInput.setAttribute("aria-label", "Todoの期限を編集");

  const buttonGroup = document.createElement("div");
  buttonGroup.className = "edit-actions";
  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "save-edit-button";
  saveButton.textContent = "保存";
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "cancel-edit-button";
  cancelButton.textContent = "キャンセル";
  buttonGroup.append(saveButton, cancelButton);
  form.append(textInput, dateInput, buttonGroup);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    event.stopPropagation();
    const newText = textInput.value.trim();
    if (newText === "") {
      textInput.focus();
      return;
    }
    todo.text = newText;
    todo.dueDate = dateInput.value || "";
    editingTodoId = null;
    saveTodos();
    renderTodos();
  });

  cancelButton.addEventListener("click", function () {
    editingTodoId = null;
    renderTodos();
  });

  form.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      editingTodoId = null;
      renderTodos();
    }
  });
  return form;
}

function addDragEvents(handle, card, todo) {
  handle.addEventListener("dragstart", function (event) {
    if (String(editingTodoId) === String(todo.id)) {
      event.preventDefault();
      return;
    }
    draggedTodoId = todo.id;
    card.classList.add("dragging");
    handle.classList.add("dragging-handle");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(todo.id));
  });

  handle.addEventListener("dragend", finishDrag);

  handle.addEventListener("pointerdown", function (event) {
    if (event.pointerType === "mouse" || String(editingTodoId) === String(todo.id)) return;

    event.preventDefault();
    draggedTodoId = todo.id;
    pointerDrag = {
      pointerId: event.pointerId,
      targetTodoId: todo.id,
      insertAfter: false
    };
    handle.setPointerCapture(event.pointerId);
    card.classList.add("dragging");
    handle.classList.add("dragging-handle");
  });

  handle.addEventListener("pointermove", function (event) {
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
    event.preventDefault();

    const targetCard = document.elementFromPoint(event.clientX, event.clientY)?.closest(".todo-item");
    if (!targetCard || targetCard === card || targetCard.dataset.completed !== String(todo.completed)) {
      clearDragOver();
      pointerDrag.targetTodoId = todo.id;
      return;
    }

    const rect = targetCard.getBoundingClientRect();
    pointerDrag.targetTodoId = targetCard.dataset.todoId;
    pointerDrag.insertAfter = event.clientY >= rect.top + rect.height / 2;
    clearDragOver();
    targetCard.classList.add(pointerDrag.insertAfter ? "drag-over-after" : "drag-over-before");
  });

  handle.addEventListener("pointerup", finishPointerDrag);
  handle.addEventListener("pointercancel", cancelPointerDrag);

  card.addEventListener("touchstart", function (event) {
    if (event.touches.length !== 1 || String(editingTodoId) === String(todo.id)) return;
    if (event.target.closest("button, input, form, label, a")) return;

    const touch = event.changedTouches[0];
    clearTimeout(cardTouchTimer);
    cardTouchDrag = {
      touchId: touch.identifier,
      todoId: todo.id,
      targetTodoId: todo.id,
      insertAfter: false,
      startX: touch.clientX,
      startY: touch.clientY,
      active: false
    };

    cardTouchTimer = setTimeout(function () {
      if (!cardTouchDrag || cardTouchDrag.touchId !== touch.identifier) return;
      cardTouchDrag.active = true;
      draggedTodoId = todo.id;
      card.classList.add("dragging");
      handle.classList.add("dragging-handle");
    }, 350);
  }, { passive: true });

  card.addEventListener("touchmove", function (event) {
    if (!cardTouchDrag || cardTouchDrag.todoId !== todo.id) return;
    const touch = Array.from(event.changedTouches).find(function (item) {
      return item.identifier === cardTouchDrag.touchId;
    });
    if (!touch) return;

    if (!cardTouchDrag.active) {
      const movedX = Math.abs(touch.clientX - cardTouchDrag.startX);
      const movedY = Math.abs(touch.clientY - cardTouchDrag.startY);
      if (movedX > 8 || movedY > 8) cancelCardTouchDrag();
      return;
    }

    event.preventDefault();
    const targetCard = document.elementFromPoint(touch.clientX, touch.clientY)?.closest(".todo-item");
    if (!targetCard || targetCard === card || targetCard.dataset.completed !== String(todo.completed)) {
      clearDragOver();
      cardTouchDrag.targetTodoId = todo.id;
      return;
    }

    const rect = targetCard.getBoundingClientRect();
    cardTouchDrag.targetTodoId = targetCard.dataset.todoId;
    cardTouchDrag.insertAfter = touch.clientY >= rect.top + rect.height / 2;
    clearDragOver();
    targetCard.classList.add(cardTouchDrag.insertAfter ? "drag-over-after" : "drag-over-before");
  }, { passive: false });

  card.addEventListener("touchend", finishCardTouchDrag, { passive: false });
  card.addEventListener("touchcancel", cancelCardTouchDrag);

  card.addEventListener("dragover", function (event) {
    const draggedTodo = getTodoById(draggedTodoId);
    if (!draggedTodo || draggedTodo.id === todo.id || draggedTodo.completed !== todo.completed) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    clearDragOver();
    const rect = card.getBoundingClientRect();
    card.classList.add(event.clientY < rect.top + rect.height / 2 ? "drag-over-before" : "drag-over-after");
  });

  card.addEventListener("dragleave", function (event) {
    if (!card.contains(event.relatedTarget)) card.classList.remove("drag-over-before", "drag-over-after");
  });

  card.addEventListener("drop", function (event) {
    event.preventDefault();
    const draggedTodo = getTodoById(draggedTodoId);
    if (!draggedTodo || draggedTodo.id === todo.id || draggedTodo.completed !== todo.completed) {
      finishDrag();
      return;
    }

    const group = getSortedTodos().filter(function (item) { return item.completed === todo.completed; });
    const fromIndex = group.findIndex(function (item) { return item.id === draggedTodo.id; });
    let toIndex = group.findIndex(function (item) { return item.id === todo.id; });
    const rect = card.getBoundingClientRect();
    const insertAfter = event.clientY >= rect.top + rect.height / 2;
    group.splice(fromIndex, 1);
    if (fromIndex < toIndex) toIndex -= 1;
    if (insertAfter) toIndex += 1;
    group.splice(toIndex, 0, draggedTodo);
    group.forEach(function (item, index) { item.order = index; });
    normalizeOrders();
    saveTodos();
    finishDrag();
    renderTodos();
  });
}

function finishCardTouchDrag(event) {
  clearTimeout(cardTouchTimer);
  if (!cardTouchDrag) return;

  const wasActive = cardTouchDrag.active;
  if (wasActive) event.preventDefault();
  const draggedTodo = getTodoById(cardTouchDrag.todoId);
  const targetTodo = getTodoById(cardTouchDrag.targetTodoId);
  if (wasActive && draggedTodo && targetTodo && draggedTodo.id !== targetTodo.id && draggedTodo.completed === targetTodo.completed) {
    reorderTodo(draggedTodo, targetTodo, cardTouchDrag.insertAfter);
    saveTodos();
  }

  cardTouchDrag = null;
  cardTouchTimer = null;
  finishDrag();
  if (wasActive) renderTodos();
}

function cancelCardTouchDrag() {
  clearTimeout(cardTouchTimer);
  cardTouchTimer = null;
  cardTouchDrag = null;
  finishDrag();
}

function finishPointerDrag(event) {
  if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;

  const draggedTodo = getTodoById(draggedTodoId);
  const targetTodo = getTodoById(pointerDrag.targetTodoId);
  if (draggedTodo && targetTodo && draggedTodo.id !== targetTodo.id && draggedTodo.completed === targetTodo.completed) {
    reorderTodo(draggedTodo, targetTodo, pointerDrag.insertAfter);
    saveTodos();
  }

  pointerDrag = null;
  finishDrag();
  renderTodos();
}

function cancelPointerDrag(event) {
  if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
  pointerDrag = null;
  finishDrag();
}

function reorderTodo(draggedTodo, targetTodo, insertAfter) {
  const group = getSortedTodos().filter(function (item) { return item.completed === targetTodo.completed; });
  const fromIndex = group.findIndex(function (item) { return item.id === draggedTodo.id; });
  let toIndex = group.findIndex(function (item) { return item.id === targetTodo.id; });
  if (fromIndex < 0 || toIndex < 0) return;

  group.splice(fromIndex, 1);
  if (fromIndex < toIndex) toIndex -= 1;
  if (insertAfter) toIndex += 1;
  group.splice(toIndex, 0, draggedTodo);
  group.forEach(function (item, index) { item.order = index; });
  normalizeOrders();
}

function finishDrag() {
  draggedTodoId = null;
  document.querySelectorAll(".dragging, .dragging-handle, .drag-over-before, .drag-over-after").forEach(function (element) {
    element.classList.remove("dragging", "dragging-handle", "drag-over-before", "drag-over-after");
  });
}

function clearDragOver() {
  document.querySelectorAll(".drag-over-before, .drag-over-after").forEach(function (element) {
    element.classList.remove("drag-over-before", "drag-over-after");
  });
}

function getSortedTodos() {
  return todos.slice().sort(function (a, b) {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.order - b.order;
  });
}

function normalizeOrders() {
  [false, true].forEach(function (completed) {
    todos.filter(function (todo) { return todo.completed === completed; })
      .sort(function (a, b) { return a.order - b.order; })
      .forEach(function (todo, index) { todo.order = index; });
  });
}

function getNextOrder(completed, excludedId) {
  return todos.filter(function (todo) {
    return todo.completed === completed && todo.id !== excludedId;
  }).length;
}

function getTodoById(id) {
  return todos.find(function (todo) { return String(todo.id) === String(id); });
}

function formatDueDate(dateText) {
  const parts = dateText.split("-");
  return Number(parts[1]) + "/" + Number(parts[2]) + "まで";
}

function getLocalDateString(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function loadTodos() {
  const savedData = localStorage.getItem(STORAGE_KEY);
  if (savedData === null) return [];
  try {
    const parsedData = JSON.parse(savedData);
    return Array.isArray(parsedData) ? parsedData : [];
  } catch (error) {
    return [];
  }
}

function getNextId() {
  if (todos.length === 0) return 1;
  return Math.max(...todos.map(function (todo) { return Number(todo.id) || 0; })) + 1;
}
