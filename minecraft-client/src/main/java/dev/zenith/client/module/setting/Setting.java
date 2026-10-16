package dev.zenith.client.module.setting;

import com.google.gson.JsonElement;

public abstract class Setting<T> {
    private final String id;
    private final String name;
    private final T defaultValue;
    protected T value;
    private final java.util.List<Runnable> listeners = new java.util.ArrayList<>();

    protected Setting(String id, String name, T defaultValue) {
        this.id = id;
        this.name = name;
        this.defaultValue = defaultValue;
        this.value = defaultValue;
    }

    public String id() { return id; }
    public String name() { return name; }
    public T get() { return value; }
    public T defaultValue() { return defaultValue; }

    public void set(T next) {
        T normalized = normalize(next);
        if (!normalized.equals(value)) {
            value = normalized;
            for (Runnable r : listeners) r.run();
        }
    }

    public void reset() { set(defaultValue); }

    public void addListener(Runnable listener) { listeners.add(listener); }

    protected T normalize(T v) { return v; }

    public abstract JsonElement toJson();

    /** Applies a persisted value; invalid input is ignored and the current value kept. */
    public abstract void fromJson(JsonElement json);

    /** Parses user input from the /zenith set command. Returns false when invalid. */
    public abstract boolean parse(String input);

    public String display() { return String.valueOf(value); }
}
