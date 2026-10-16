package dev.zenith.client.module;

public enum Category {
    HUD("HUD", "On-screen information"),
    PERFORMANCE("Performance", "Frame rate and resource usage"),
    MOVEMENT("Movement", "Quality-of-life movement helpers"),
    VISUAL("Visual", "Camera and rendering tweaks"),
    CLIENT("Client", "Zenith behaviour and interface");

    public final String displayName;
    public final String description;

    Category(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }
}
