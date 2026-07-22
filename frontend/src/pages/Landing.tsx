import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { fetchCategories, type Category } from "../api/providers";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

const HOW_IT_WORKS = [
  {
    title: "Tell us what you need",
    body: "Pick a category, describe the job, and drop a pin on the map — takes under a minute.",
  },
  {
    title: "Get matched instantly",
    body: "We broadcast your request to verified providers nearby. The first to accept gets the job.",
  },
  {
    title: "Track, chat, and pay",
    body: "Watch your provider's live status, chat in-app, and pay when the job's done — cash or card.",
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchCategories().then((res) => setCategories(res.categories));
  }, []);

  function handleCategoryClick(subServiceId: string) {
    if (!user) {
      navigate("/login", { state: { redirectTo: `/requests/new?subServiceId=${subServiceId}` } });
      return;
    }
    if (user.role === "CUSTOMER") {
      navigate(`/requests/new?subServiceId=${subServiceId}`);
    } else {
      navigate("/dashboard");
    }
  }

  return (
    <div>
      <section style={{ position: "relative", overflow: "hidden", padding: "110px 0 90px" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(249,115,22,0.22), transparent 70%)",
            filter: "blur(10px)",
            animation: "floaty 8s ease-in-out infinite",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: -150,
            left: -100,
            width: 380,
            height: 380,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,235,0.14), transparent 70%)",
            filter: "blur(10px)",
            animation: "floaty 10s ease-in-out infinite reverse",
          }}
        />

        <div className="container" style={{ position: "relative", textAlign: "center" }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="badge" style={{ marginBottom: 20 }}>
              ⚡ Live matching in your city
            </span>
            <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", lineHeight: 1.05, margin: "18px 0" }}>
              Trusted local help,
              <br />
              <span className="gradient-text">on demand.</span>
            </h1>
            <p style={{ maxWidth: 560, margin: "0 auto 32px", fontSize: 17 }}>
              Plumbers, electricians, cleaners, tutors and more — verified, rated, and ready to broadcast to in
              minutes. No calling around, no guesswork.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <Button
                onClick={() => {
                  if (user?.role === "CUSTOMER") navigate("/requests/new");
                  else document.getElementById("categories")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Request a service
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (user?.role === "PROVIDER") navigate("/dashboard");
                  else navigate("/register?role=PROVIDER");
                }}
              >
                {user?.role === "PROVIDER" ? "Go to my dashboard" : "Become a provider"}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="categories" className="container" style={{ padding: "40px 0 80px" }}>
        <h2 style={{ textAlign: "center", fontSize: 30 }}>What do you need help with?</h2>
        <p style={{ textAlign: "center", maxWidth: 480, margin: "0 auto 40px" }}>
          Browse categories below. Pick a service and we'll take you straight to requesting it.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          {categories.map((cat, i) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: (i % 8) * 0.04 }}
            >
              <Card style={{ padding: 20, height: "100%" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{cat.icon}</div>
                <h3 style={{ fontSize: 17, marginBottom: 10 }}>{cat.name}</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {cat.subServices.slice(0, 4).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleCategoryClick(s.id)}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: "5px 10px", border: "1px solid var(--border)", borderRadius: 999 }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="how-it-works" style={{ background: "var(--bg-1)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "80px 0" }}>
        <div className="container">
          <h2 style={{ textAlign: "center", fontSize: 30, marginBottom: 50 }}>How ServiceConnect works</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <Card style={{ padding: 26, height: "100%" }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--accent-gradient)",
                      color: "#ffffff",
                      fontWeight: 700,
                      marginBottom: 14,
                    }}
                  >
                    {i + 1}
                  </div>
                  <h3 style={{ fontSize: 18 }}>{step.title}</h3>
                  <p>{step.body}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="container" style={{ padding: "80px 0", textAlign: "center" }}>
        <h2 style={{ fontSize: 32 }}>
          Ready to get started?
        </h2>
        <p style={{ maxWidth: 460, margin: "0 auto 28px" }}>
          Join as a customer to request your first service, or sign up as a provider and start getting jobs today.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Button onClick={() => navigate("/register")}>Create an account</Button>
          <Button variant="secondary" onClick={() => navigate("/login")}>
            I already have an account
          </Button>
        </div>
      </section>
    </div>
  );
}
