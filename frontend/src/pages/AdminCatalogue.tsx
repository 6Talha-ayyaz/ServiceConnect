import { useEffect, useState } from "react";
import {
  fetchAllCategories,
  createCategory,
  deactivateCategory,
  createSubService,
  deactivateSubService,
  type AdminCategory,
} from "../api/admin";
import { ApiError } from "../api/client";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

export function AdminCataloguePage() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("");
  const [newSubService, setNewSubService] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetchAllCategories();
    setCategories(res.categories);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createCategory({ name: newCategoryName, icon: newCategoryIcon || undefined });
      setNewCategoryName("");
      setNewCategoryIcon("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleDeactivateCategory(id: string) {
    setError(null);
    try {
      await deactivateCategory(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleCreateSubService(categoryId: string) {
    const name = newSubService[categoryId];
    if (!name || name.trim().length < 2) {
      setError("Enter a sub-service name (min 2 characters).");
      return;
    }
    setError(null);
    try {
      await createSubService({ categoryId, name, defaultPricing: "INSPECT_THEN_QUOTE" });
      setNewSubService({ ...newSubService, [categoryId]: "" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleDeactivateSubService(id: string) {
    setError(null);
    try {
      await deactivateSubService(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  if (loading) return <p className="muted" style={{ textAlign: "center", marginTop: 40 }}>Loading...</p>;

  return (
    <div className="container" style={{ padding: "60px 0" }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Service catalogue</h1>
      <p style={{ marginBottom: 20 }}>Manage categories and sub-services without a code deployment (FR-3.5).</p>
      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

      <Card style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ marginBottom: 10 }}>Add a category</h3>
        <form onSubmit={handleCreateCategory} style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="Icon (emoji)"
            value={newCategoryIcon}
            onChange={(e) => setNewCategoryIcon(e.target.value)}
            style={{ width: 80 }}
          />
          <input
            className="input"
            placeholder="Category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            required
            style={{ flex: 1 }}
          />
          <Button type="submit">Add category</Button>
        </form>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {categories.map((cat) => (
          <Card key={cat.id} style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{cat.icon} {cat.name}</h3>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {!cat.active && <Badge tone="danger">Inactive</Badge>}
                {cat.active && (
                  <Button size="sm" variant="danger" onClick={() => handleDeactivateCategory(cat.id)}>
                    Deactivate
                  </Button>
                )}
              </div>
            </div>

            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {cat.subServices.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span>{s.name} {!s.active && <Badge tone="danger">Inactive</Badge>}</span>
                  {s.active && (
                    <Button size="sm" variant="ghost" onClick={() => handleDeactivateSubService(s.id)}>
                      Deactivate
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                className="input"
                placeholder="New sub-service name"
                value={newSubService[cat.id] ?? ""}
                onChange={(e) => setNewSubService({ ...newSubService, [cat.id]: e.target.value })}
              />
              <Button size="sm" variant="secondary" onClick={() => handleCreateSubService(cat.id)}>
                Add
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
