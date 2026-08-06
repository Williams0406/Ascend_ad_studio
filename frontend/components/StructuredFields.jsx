"use client";

import { useState } from "react";

export function TagsInput({
  value = [],
  onChange,
  placeholder = "Escribe y presiona Enter",
  limit = 20,
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const next = draft.trim();
    if (next && value.length < limit && !value.includes(next))
      onChange([...value, next]);
    setDraft("");
  }
  return (
    <div className="structured-tags">
      <div>
        {value.map((item, index) => (
          <button
            type="button"
            key={`${item}-${index}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            {item}
            <b>×</b>
          </button>
        ))}
      </div>
      <input
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
      <small>
        {value.length}/{limit}
      </small>
    </div>
  );
}

export function ObjectList({
  value = [],
  onChange,
  fields = [],
  addLabel = "Agregar",
  emptyText = "Aún no hay elementos.",
}) {
  function getDefaultValue(field) {
    if (field.default !== undefined) {
      return field.default;
    }

    if (field.type === "checkbox") {
      return false;
    }

    if (field.type === "number") {
      return field.min ?? 0;
    }

    if (field.type === "select") {
      return field.options?.[0]?.[0] ?? "";
    }

    if (field.type === "color") {
      return "#B67A45";
    }

    return "";
  }

  function add() {
    const newItem = Object.fromEntries(
      fields.map((field) => [field.key, getDefaultValue(field)]),
    );

    onChange([...value, newItem]);
  }

  function update(index, key, next) {
    onChange(
      value.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: next,
            }
          : item,
      ),
    );
  }

  function remove(index) {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  }

  function move(index, direction) {
    const destination = index + direction;

    if (destination < 0 || destination >= value.length) {
      return;
    }

    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(destination, 0, item);

    onChange(next);
  }

  function getItemTitle(item, index) {
    return (
      item.name ||
      item.label ||
      item.family ||
      item.term ||
      item.position ||
      `Valor ${index + 1}`
    );
  }

  return (
    <div className="object-list">
      {value.length > 0 ? (
        <div className="object-list-items">
          {value.map((item, index) => (
            <article className="object-list-item" key={item.id || index}>
              <header className="object-list-item__header">
                <div className="object-list-item__identity">
                  <span className="object-list-item__number">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div>
                    <small>Valor de regla</small>

                    <strong>{getItemTitle(item, index)}</strong>
                  </div>
                </div>

                <div className="object-list-item__actions">
                  {value.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="object-list-item__move"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        aria-label="Mover hacia arriba"
                        title="Mover hacia arriba"
                      >
                        ↑
                      </button>

                      <button
                        type="button"
                        className="object-list-item__move"
                        onClick={() => move(index, 1)}
                        disabled={index === value.length - 1}
                        aria-label="Mover hacia abajo"
                        title="Mover hacia abajo"
                      >
                        ↓
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="object-list-item__remove"
                    onClick={() => remove(index)}
                    aria-label={`Eliminar valor ${index + 1}`}
                    title="Eliminar valor"
                  >
                    ×
                  </button>
                </div>
              </header>

              <div className="object-list-fields">
                {fields.map((field) => {
                  const currentValue =
                    item[field.key] ?? getDefaultValue(field);

                  const fieldClassName = [
                    "object-list-field",
                    field.wide ? "object-list-field--wide" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  if (field.type === "checkbox") {
                    return (
                      <label
                        className={[
                          "object-list-checkbox",
                          field.wide ? "object-list-field--wide" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={field.key}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(currentValue)}
                          onChange={(event) =>
                            update(index, field.key, event.target.checked)
                          }
                        />

                        <span
                          className="object-list-checkbox__control"
                          aria-hidden="true"
                        >
                          ✓
                        </span>

                        <span className="object-list-checkbox__copy">
                          <strong>{field.label}</strong>

                          <small>
                            {field.hint ||
                              "Activa esta condición para el valor."}
                          </small>
                        </span>
                      </label>
                    );
                  }

                  if (field.type === "color") {
                    const safeColor = /^#[0-9a-f]{6}$/i.test(
                      String(currentValue),
                    )
                      ? currentValue
                      : "#B67A45";

                    return (
                      <label
                        className={`${fieldClassName} object-list-color-field`}
                        key={field.key}
                      >
                        <span className="object-list-field__label">
                          {field.label}
                        </span>

                        <div className="object-list-color-control">
                          <label
                            className="object-list-color-control__preview"
                            style={{
                              "--rule-color": safeColor,
                            }}
                            title="Seleccionar color"
                          >
                            <input
                              type="color"
                              value={safeColor}
                              onChange={(event) =>
                                update(
                                  index,
                                  field.key,
                                  event.target.value.toUpperCase(),
                                )
                              }
                            />

                            <span aria-hidden="true" />
                          </label>

                          <input
                            className="input object-list-color-control__text"
                            value={currentValue}
                            maxLength={7}
                            placeholder="#B67A45"
                            onChange={(event) =>
                              update(
                                index,
                                field.key,
                                event.target.value.toUpperCase(),
                              )
                            }
                          />
                        </div>

                        <small className="object-list-field__hint">
                          Selecciona un color o escribe su valor HEX.
                        </small>
                      </label>
                    );
                  }

                  if (field.type === "select") {
                    return (
                      <label className={fieldClassName} key={field.key}>
                        <span className="object-list-field__label">
                          {field.label}
                        </span>

                        <div className="object-list-select">
                          <select
                            className="input"
                            value={currentValue}
                            onChange={(event) =>
                              update(index, field.key, event.target.value)
                            }
                          >
                            {(field.options || []).map(
                              ([optionValue, optionLabel]) => (
                                <option value={optionValue} key={optionValue}>
                                  {optionLabel}
                                </option>
                              ),
                            )}
                          </select>

                          <span aria-hidden="true">⌄</span>
                        </div>

                        {field.hint && (
                          <small className="object-list-field__hint">
                            {field.hint}
                          </small>
                        )}
                      </label>
                    );
                  }

                  if (field.type === "textarea") {
                    return (
                      <label
                        className={`${fieldClassName} object-list-field--wide`}
                        key={field.key}
                      >
                        <span className="object-list-field__label">
                          {field.label}
                        </span>

                        <textarea
                          className="input textarea"
                          value={currentValue}
                          placeholder={field.placeholder || ""}
                          onChange={(event) =>
                            update(index, field.key, event.target.value)
                          }
                        />

                        {field.hint && (
                          <small className="object-list-field__hint">
                            {field.hint}
                          </small>
                        )}
                      </label>
                    );
                  }

                  return (
                    <label className={fieldClassName} key={field.key}>
                      <span className="object-list-field__label">
                        {field.label}
                      </span>

                      <input
                        className="input"
                        type={field.type === "number" ? "number" : "text"}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={currentValue}
                        placeholder={field.placeholder || ""}
                        onChange={(event) => {
                          const nextValue =
                            field.type === "number"
                              ? event.target.value === ""
                                ? ""
                                : Number(event.target.value)
                              : event.target.value;

                          update(index, field.key, nextValue);
                        }}
                      />

                      {field.hint && (
                        <small className="object-list-field__hint">
                          {field.hint}
                        </small>
                      )}
                    </label>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="object-list-empty">
          <span aria-hidden="true">＋</span>

          <div>
            <strong>Sin valores configurados</strong>
            <p>{emptyText}</p>
          </div>
        </div>
      )}

      <button
        type="button"
        className="structured-add object-list-add"
        onClick={add}
      >
        <span className="object-list-add__icon" aria-hidden="true">
          ＋
        </span>

        <span className="object-list-add__copy">
          <strong>{addLabel}</strong>

          <small>Añade un nuevo valor a esta categoría</small>
        </span>

        <span className="object-list-add__arrow" aria-hidden="true">
          →
        </span>
      </button>
    </div>
  );
}

export function ChoiceCards({ value = [], onChange, options }) {
  return (
    <div className="structured-choices">
      {options.map(([key, label, hint]) => (
        <button
          type="button"
          key={key}
          className={value.includes(key) ? "active" : ""}
          onClick={() =>
            onChange(
              value.includes(key)
                ? value.filter((v) => v !== key)
                : [...value, key],
            )
          }
        >
          <i>{value.includes(key) ? "✓" : "+"}</i>
          <span>
            {label}
            <small>{hint}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
