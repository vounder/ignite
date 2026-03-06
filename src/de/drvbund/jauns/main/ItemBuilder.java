package de.drvbund.jauns.main;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.EnumSet;
public class ItemBuilder {

    private Integer preis = 0;
    private String beschreibung = null;
    private EnumSet<Effekt> effekte = null;
    private int loaderIndex = 0;
    private Path grafikPath = null;
    private String grafikPathString = null;

    public ItemBuilder setPreis(Integer preis) {
        this.preis = preis;
        return this;
    }

    public ItemBuilder setBeschreibung(String beschreibung) {
        this.beschreibung = beschreibung;
        return this;
    }

    public ItemBuilder setEffekte(EnumSet<Effekt> effekte) {
        this.effekte = effekte;
        return this;
    }

    public ItemBuilder setLoaderIndex(int loaderIndex) {
        this.loaderIndex = loaderIndex;
        return this;
    }

    public ItemBuilder setGrafikPath(Path grafikPath) {
        this.grafikPath = grafikPath;
        return this;
    }

    public ItemBuilder setGrafikPathString(String grafikPathString) {
        this.grafikPathString = grafikPathString;
        return this;
    }

    /**
     * Erzeugt und gibt ein neues {@link Item}-Objekt mit den aktuell im Builder
     * gesetzten Eigenschaften zurück.
     *
     * @return Ein neues {@link Item}-Objekt mit den gesetzten Attributen.
     */
    public Item build() {
        Item item = new Item();
        item.setPreis(preis);
        item.setBeschreibung(beschreibung);
        item.setEffekte(effekte);
        item.setLoaderIndex(loaderIndex);
        item.setGrafikPath(grafikPath);
        item.setGrafikPathString(grafikPathString);
        return item;
    }
}
