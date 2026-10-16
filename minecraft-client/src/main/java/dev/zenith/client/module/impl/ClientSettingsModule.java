package dev.zenith.client.module.impl;

import dev.zenith.client.module.Category;
import dev.zenith.client.module.Module;
import dev.zenith.client.module.setting.BooleanSetting;
import dev.zenith.client.notification.Notifications;

/** Client-wide preferences; always enabled. */
public final class ClientSettingsModule extends Module {
    public final BooleanSetting customMenu = add(new BooleanSetting("custom_main_menu", "Zenith main menu", true));
    public final BooleanSetting notifications = add(new BooleanSetting("notifications", "Notifications", true));
    public final BooleanSetting blur = add(new BooleanSetting("menu_blur", "Blur behind Zenith menu", true));

    public ClientSettingsModule() {
        super("client", "Client Settings", "Main menu, notifications and interface preferences", Category.CLIENT, true);
        notifications.addListener(() -> Notifications.setEnabled(notifications.get()));
    }

    @Override public boolean toggleable() { return false; }
}
