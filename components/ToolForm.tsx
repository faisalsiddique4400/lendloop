"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import { CATEGORIES, CONDITIONS, type Category, type Condition } from "@/convex/lib/validators";
import { errorText } from "@/lib/errors";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { useToast } from "./ui/Toast";

export type MyTool = FunctionReturnType<typeof api.tools.mine>[number];
type Values = { name: string; category: Category; condition: Condition; description: string };

const EMPTY: Values = { name: "", category: "Power tools", condition: "Good", description: "" };

export function ToolForm({ editing, onDone }: { editing: MyTool | null; onDone: () => void }) {
  const [values, setValues] = useState<Values>(
    editing ? { name: editing.name, category: editing.category, condition: editing.condition, description: editing.description } : EMPTY,
  );
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState("");
  const create = useMutation(api.tools.create);
  const update = useMutation(api.tools.update);
  const toast = useToast();

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((old) => ({ ...old, [key]: value }));
  const nameError = tried && !values.name.trim() ? "Give the tool a name." : "";

  async function save(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (!values.name.trim()) return;
    try {
      if (editing) {
        await update({ toolId: editing._id, ...values });
        toast("Changes saved.");
      } else {
        await create(values);
        toast(`${values.name.trim()} is listed. Neighbors can ask for it now.`);
      }
      setValues(EMPTY);
      setTried(false);
      setServerError("");
      onDone();
    } catch (err) {
      setServerError(errorText(err));
    }
  }

  return (
    <form className="panel form" aria-labelledby="form-h" onSubmit={save} noValidate>
      <h2 id="form-h">{editing ? `Edit ${editing.name}` : "Add a tool"}</h2>
      <Field id="tname" label="Name" error={nameError}>
        <input id="tname" value={values.name} maxLength={60} onChange={(e) => set("name", e.target.value)} aria-invalid={!!nameError} aria-describedby="tname-msg" />
      </Field>
      <div className="two">
        <Field id="tcat" label="Category">
          <select id="tcat" value={values.category} onChange={(e) => set("category", e.target.value as Category)}>
            {CATEGORIES.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </Field>
        <Field id="tcond" label="Condition">
          <select id="tcond" value={values.condition} onChange={(e) => set("condition", e.target.value as Condition)}>
            {CONDITIONS.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        id="tdesc"
        label="Short description"
        help={
          <span className="span-note">
            <span>Leave out your address.</span>
            <span className="counter">{values.description.length}/200</span>
          </span>
        }
      >
        <textarea id="tdesc" maxLength={200} value={values.description} onChange={(e) => set("description", e.target.value)} aria-describedby="tdesc-msg" />
      </Field>
      {serverError && (
        <p className="err-text" role="alert">
          {serverError}
        </p>
      )}
      <div className="actions">
        {editing && (
          <Button variant="quiet" onClick={onDone}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary">
          {editing ? "Save changes" : "Save tool"}
        </Button>
      </div>
    </form>
  );
}
