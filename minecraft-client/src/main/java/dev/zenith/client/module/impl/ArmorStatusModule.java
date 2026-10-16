package dev.zenith.client.module.impl;

import dev.zenith.client.hud.HudModule;
import dev.zenith.client.hud.Theme;
import dev.zenith.client.module.setting.BooleanSetting;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

public final class ArmorStatusModule extends HudModule {
    private static final EquipmentSlot[] SLOTS = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET};
    private final BooleanSetting held = add(new BooleanSetting("held", "Include held item", true));
    private final BooleanSetting durability = add(new BooleanSetting("durability", "Durability text", true));

    public ArmorStatusModule() { super("armor", "Armor Status", "Shows equipped armor and remaining durability", false, 1.0, 0.5); }

    @Override protected int[] draw(GuiGraphics g, Minecraft mc, boolean preview) {
        List<ItemStack> stacks = new ArrayList<>();
        if (mc.player != null) {
            for (EquipmentSlot s : SLOTS) {
                ItemStack st = mc.player.getItemBySlot(s);
                if (!st.isEmpty()) stacks.add(st);
            }
            if (held.get() && !mc.player.getMainHandItem().isEmpty()) stacks.add(mc.player.getMainHandItem());
        }
        if (stacks.isEmpty() && preview) {
            stacks.add(new ItemStack(Items.DIAMOND_HELMET));
            stacks.add(new ItemStack(Items.DIAMOND_CHESTPLATE));
            stacks.add(new ItemStack(Items.DIAMOND_LEGGINGS));
            stacks.add(new ItemStack(Items.DIAMOND_BOOTS));
        }
        int w = 20;
        for (ItemStack st : stacks) if (durability.get() && st.isDamageableItem()) w = Math.max(w, 22 + mc.font.width(label(st)));
        w += 4;
        int h = Math.max(18, stacks.size() * 18 + 2);
        if (background.get()) g.fill(0, 0, w, h, Theme.HUD_BG);
        for (int i = 0; i < stacks.size(); i++) {
            ItemStack st = stacks.get(i);
            int y = 1 + i * 18;
            g.renderItem(st, 2, y);
            g.renderItemDecorations(mc.font, st, 2, y);
            if (durability.get() && st.isDamageableItem()) {
                float pct = (st.getMaxDamage() - st.getDamageValue()) / (float) st.getMaxDamage();
                int color = pct > 0.5f ? Theme.GREEN : pct > 0.2f ? Theme.AMBER : Theme.RED;
                g.drawString(mc.font, label(st), 22, y + 5, color, true);
            }
        }
        return new int[] {w, h};
    }

    private static String label(ItemStack st) {
        return String.valueOf(st.getMaxDamage() - st.getDamageValue());
    }
}
