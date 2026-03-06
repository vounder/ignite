package de.drvbund.jauns.main;

import java.nio.file.Path;
import java.util.EnumSet;

/**
 * Builder-Klasse zur einfachen und flexiblen Erstellung von {@link Karte}-Objekten.
 * <p>
 * Erlaubt das schrittweise Setzen von Eigenschaften und das anschließende
 * Erzeugen eines Kartenobjekts über die {@code build()}-Methode.
 * </p>
 */
public class KartenBuilder {

    Nummer nummer;
    Farbe farbe;
    EnumSet<Zusatzkarte> zusätze;
    Integer addierWert;
    String beschreibung;
    Integer preis;
    Path grafikPath;
    int loaderIndex = 0;
    
    // Spezialwerte
    Integer blockRundenAnzahl;
    Integer zerstörungAnzahl;
    Integer fluchRundenAnzahl;
    Integer bonusGeldMult;
    Integer kartenAnguckenRundenAnzahl;
    Integer hodlWert;
    Integer aussetzWert;

    public KartenBuilder setLoaderIndex(int index) {
    	this.loaderIndex = index;
    	return this;
    }
    
    public KartenBuilder setNummer(Nummer nummer) {
        this.nummer = nummer;
        return this;
    }

    public KartenBuilder setFarbe(Farbe farbe) {
        this.farbe = farbe;
        return this;
    }

    public KartenBuilder setZusätze(EnumSet<Zusatzkarte> zusätze) {
        if (zusätze == null)
            this.zusätze = EnumSet.noneOf(Zusatzkarte.class);
        else
            this.zusätze = zusätze;
        return this;
    }


    public KartenBuilder setAddierWert(Integer addierWert) {
        this.addierWert = addierWert;
        return this;
    }

    public KartenBuilder setBeschreibung(String beschreibung) {
        this.beschreibung = beschreibung;
        return this;
    }

    public KartenBuilder setPreis(int preis) {
        this.preis = preis;
        return this;
    }

    public KartenBuilder setGrafikPath(Path grafikPath) {
        this.grafikPath = grafikPath;
        return this;
    }

    public KartenBuilder setBlockRundenAnzahl(Integer blockRundenAnzahl) {
        this.blockRundenAnzahl = blockRundenAnzahl;
        return this;
    }

    public KartenBuilder setZerstörungAnzahl(Integer zerstörungAnzahl) {
        this.zerstörungAnzahl = zerstörungAnzahl;
        return this;
    }

    public KartenBuilder setFluchRundenAnzahl(Integer fluchRundenAnzahl) {
        this.fluchRundenAnzahl = fluchRundenAnzahl;
        return this;
    }

    public KartenBuilder setBonusGeldMult(Integer bonusGeldMult) {
        this.bonusGeldMult = bonusGeldMult;
        return this;
    }

    public KartenBuilder setKartenAnguckenRundenAnzahl(Integer kartenAnguckenRundenAnzahl) {
        this.kartenAnguckenRundenAnzahl = kartenAnguckenRundenAnzahl;
        return this;
    }

    public KartenBuilder setHodlWert(Integer hodlWert) {
        this.hodlWert = hodlWert;
        return this;
    }
    
    public KartenBuilder setAussetzWert(Integer aussetzWert) {
        this.aussetzWert = aussetzWert;
        return this;
    }


    public Karte build() {
        return new Karte(this);
    }
}
