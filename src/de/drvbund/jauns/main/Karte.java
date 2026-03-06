package de.drvbund.jauns.main;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;

import jakarta.xml.bind.annotation.XmlAccessType;
import jakarta.xml.bind.annotation.XmlAccessorType;
import jakarta.xml.bind.annotation.XmlElement;
import jakarta.xml.bind.annotation.XmlRootElement;
import jakarta.xml.bind.annotation.XmlTransient;

@XmlRootElement
@XmlAccessorType(XmlAccessType.FIELD)
public class Karte extends ShopArtikel {

    // ──────────────── Grunddaten ────────────────
    private Nummer nummer = null;
    private Farbe farbe = null;
    @XmlTransient
    private EnumSet<Zusatzkarte> zusätze = EnumSet.noneOf(Zusatzkarte.class);
    
    // Einzelnes Feld für XML-Serialisierung (da XML nur ein <zusätze> Element hat)
    @XmlElement(name="zusätze")
    private Zusatzkarte zusatzForXml;
    private String beschreibung = null;
    private Integer preis = 0;

    // ──────────────── Spezialwerte ────────────────
    private Integer addierWert = null;
    private Integer blockRundenAnzahl = null;
    private Integer zerstörungAnzahl = null;
    private Integer fluchRundenAnzahl = null;
    private Integer bonusGeldMult = null;
    private Integer kartenAnguckenRundenAnzahl = null;
    private Integer hodlWert = null;
    private Integer aussetzWert = null;

    // ──────────────── Grafik ────────────────
    @XmlTransient
    private Path grafikPath = null;
    private String grafikPathString;
    private int loaderIndex = 0;

    // ──────────────── Konstruktoren ────────────────
    public Karte() {
        this.zusätze = EnumSet.noneOf(Zusatzkarte.class);
    }

    public Karte(KartenBuilder builder) {
        this.farbe = builder.farbe;
        this.nummer = builder.nummer;
        this.zusätze = builder.zusätze != null ? EnumSet.copyOf(builder.zusätze) : EnumSet.noneOf(Zusatzkarte.class);
        this.syncZusätzeToXml(); // XML-Feld synchronisieren
        this.addierWert = builder.addierWert;
        this.beschreibung = builder.beschreibung;
        this.preis = builder.preis;
        this.grafikPath = builder.grafikPath;
        this.grafikPathString = builder.grafikPath != null ? builder.grafikPath.toString() : null;
        this.loaderIndex = builder.loaderIndex;

        // Spezialwerte übernehmen
        this.blockRundenAnzahl = builder.blockRundenAnzahl;
        this.zerstörungAnzahl = builder.zerstörungAnzahl;
        this.fluchRundenAnzahl = builder.fluchRundenAnzahl;
        this.bonusGeldMult = builder.bonusGeldMult;
        this.kartenAnguckenRundenAnzahl = builder.kartenAnguckenRundenAnzahl;
        this.hodlWert = builder.hodlWert;
        this.aussetzWert = builder.aussetzWert;
    }

    public Karte(Karte andere) {
        this.farbe = andere.farbe;
        this.nummer = andere.nummer;
        this.zusätze = andere.zusätze != null ? EnumSet.copyOf(andere.zusätze) : EnumSet.noneOf(Zusatzkarte.class);
        this.syncZusätzeToXml(); // XML-Feld synchronisieren
        this.addierWert = andere.addierWert;
        this.beschreibung = andere.beschreibung;
        this.preis = andere.preis;
        this.grafikPath = andere.grafikPath;
        this.grafikPathString = andere.grafikPath != null ? andere.grafikPath.toString() : null;
        this.aussetzWert = andere.aussetzWert;
        this.loaderIndex = andere.loaderIndex;
    }

    // ──────────────── Getter ────────────────
    public Nummer getNummer() {
        return nummer;
    }

    public Farbe getFarbe() {
        return farbe;
    }
    
    /**
     * Gibt die Zusatzeffekte dieser Karte als EnumSet zurück.
     * <p>
     * Falls keine Zusätze vorhanden sind, wird ein leeres EnumSet zurückgegeben.
     * </p>
     *
     * @return Eine defensive Kopie des EnumSets mit den Zusatzeffekten.
     */
    public EnumSet<Zusatzkarte> getZusätze() {
        if (zusätze == null) {
            zusätze = EnumSet.noneOf(Zusatzkarte.class);
        }
        return EnumSet.copyOf(zusätze); // Defensive Kopie zurückgeben
    }

    public String getBeschreibung() {
        return (beschreibung != null && !beschreibung.trim().isEmpty()) ? beschreibung : getNullBeschreibung();
    }


    public Integer getPreis() {
        return preis;
    }

    public Path getGrafikPath() {
        return grafikPath;
    }

    public String getGrafikPathString() {
        return grafikPath != null ? grafikPath.toString() : null;
    }

    public Integer getAddierWert() {
        return addierWert;
    }

    public Integer getBlockRundenAnzahl() {
        return blockRundenAnzahl;
    }

    public Integer getZerstörungAnzahl() {
        return zerstörungAnzahl;
    }

    public Integer getFluchRundenAnzahl() {
        return fluchRundenAnzahl;
    }

    public Integer getBonusGeldMult() {
        return bonusGeldMult;
    }

    public Integer getKartenAnguckenRundenAnzahl() {
        return kartenAnguckenRundenAnzahl;
    }

    public Integer getHodlWert() {
        return hodlWert;
    }
    
    public Integer getAussetzWert() {
        return aussetzWert;
    }
    
    public int getLoaderIndex() {
        return loaderIndex;
    }
    

    /**
     * Liefert eine Liste aller Zusatzeffekte dieser Karte zurück.
     * <p>
     * Falls keine Zusätze vorhanden sind, wird eine leere Liste zurückgegeben.
     * </p>
     *
     * @return Eine neue Liste mit den Zusatzeffekten.
     */
    @XmlElement(name="zusätze")
    public List<Zusatzkarte> getZusätzeList() {
        // Diese Methode bleibt für Kompatibilität, falls sie woanders verwendet wird
        if (zusätze == null) {
            zusätze = EnumSet.noneOf(Zusatzkarte.class);
        }
        return new ArrayList<>(zusätze);
    }

    /**
     * Setzt die Zusatzeffekte dieser Karte anhand einer übergebenen Liste und synchronisiert das XML-Feld.
     * <p>
     * Bestehende Zusatzeffekte werden entfernt. Für jeden Eintrag in der Liste wird der Zusatzeffekt hinzugefügt,
     * sofern er nicht {@code null} ist.
     * </p>
     *
     * @param list Die Liste der neuen Zusatzeffekte für diese Karte.
     */
    public void setZusätzeList(List<Zusatzkarte> list) {
        System.out.println("setZusätzeList called with: " + list);
        
        if (list == null || list.isEmpty()) {
            this.zusätze = EnumSet.noneOf(Zusatzkarte.class);
        } else {
            this.zusätze = EnumSet.noneOf(Zusatzkarte.class);
            for (Zusatzkarte z : list) {
                if (z != null) {
                    addZusatz(z);
                }
            }
        }
        
        syncZusätzeToXml();
        System.out.println("zusätze after setting: " + this.zusätze);
    }

    // Getter/Setter für das einzelne XML-Feld (das ist das was JAXB tatsächlich verwendet)
    public Zusatzkarte getZusatzForXml() {
        return zusatzForXml;
    }

    /**
     * Setzt den Zusatzwert für die XML-Serialisierung und aktualisiert die internen Zusätze entsprechend.
     * <p>
     * Wenn {@code zusatz} {@code null} ist, wird das Zusätze-Set geleert; andernfalls wird es auf genau diesen Wert gesetzt.
     * </p>
     *
     * @param zusatz Der Zusatz, der für die XML-Repräsentation gesetzt werden soll.
     */
    public void setZusatzForXml(Zusatzkarte zusatz) {
        System.out.println("setZusatzForXml called with: " + zusatz);
        this.zusatzForXml = zusatz;
        
        // EnumSet basierend auf dem XML-Wert aktualisieren
        if (zusatz == null) {
            this.zusätze = EnumSet.noneOf(Zusatzkarte.class);
        } else {
            this.zusätze = EnumSet.of(zusatz);
        }
        
        System.out.println("zusätze after setting single: " + this.zusätze);
    }

    // ──────────────── Setter ────────────────
    public void setBeschreibung(String beschreibung) {
        this.beschreibung = beschreibung;
    }

    public void setPreis(Integer preis) {
        this.preis = preis;
    }

    public void setGrafikPath(Path grafikPath) {
        this.grafikPath = grafikPath;
        this.grafikPathString = grafikPath != null ? grafikPath.toString() : null;
    }

    public void setGrafikPathString(String pfad) {
        this.grafikPathString = pfad;
        if (pfad != null) {
            this.grafikPath = Path.of(pfad);
        }
    }

    public void setAddierWert(Integer addierWert) {
        this.addierWert = addierWert;
    }

    public void setBlockRundenAnzahl(Integer blockRundenAnzahl) {
        this.blockRundenAnzahl = blockRundenAnzahl;
    }

    public void setZerstörungAnzahl(Integer zerstörungAnzahl) {
        this.zerstörungAnzahl = zerstörungAnzahl;
    }

    public void setFluchRundenAnzahl(Integer fluchRundenAnzahl) {
        this.fluchRundenAnzahl = fluchRundenAnzahl;
    }

    public void setBonusGeldMult(Integer bonusGeldMult) {
        this.bonusGeldMult = bonusGeldMult;
    }

    public void setKartenAnguckenRundenAnzahl(Integer kartenAnguckenRundenAnzahl) {
        this.kartenAnguckenRundenAnzahl = kartenAnguckenRundenAnzahl;
    }

    public void setHodlWert(Integer hodlWert) {
        this.hodlWert = hodlWert;
    }
    
    public void setAussetzWert(Integer aussetzWert) {
        this.aussetzWert = aussetzWert;
    }
    
    public void setLoaderIndex(int loaderIndex) {
        this.loaderIndex = loaderIndex;
    }
    
    /**
     * Fügt der Karte einen Zusatzeffekt hinzu und synchronisiert das XML-Feld.
     *
     * @param zusatz Der hinzuzufügende Zusatzeffekt.
     */
    public void addZusatz(Zusatzkarte zusatz) {
        if (zusatz != null) {
            if (this.zusätze == null) {
                this.zusätze = EnumSet.noneOf(Zusatzkarte.class);
            }
            this.zusätze.add(zusatz);
            syncZusätzeToXml(); // XML-Feld synchronisieren
        }
    }

    /**
     * Entfernt einen bestimmten Zusatzeffekt aus den Zusätzen dieser Karte und synchronisiert das XML-Feld.
     *
     * @param zusatz Der zu entfernende Zusatzeffekt.
     */
    public void removeZusatz(Zusatzkarte zusatz) {
        if (this.zusätze != null && zusatz != null) {
            this.zusätze.remove(zusatz);
            syncZusätzeToXml(); // XML-Feld synchronisieren
        }
    }

    /**
     * Prüft, ob die Karte einen bestimmten Zusatzeffekt besitzt.
     *
     * @param zusatz Der zu prüfende Zusatzeffekt.
     * @return {@code true}, wenn der angegebene Zusatzeffekt in den Zusätzen dieser Karte enthalten ist, sonst {@code false}.
     */
    public boolean hasZusatz(Zusatzkarte zusatz) {
        return this.zusätze != null && zusatz != null && this.zusätze.contains(zusatz);
    }

    /**
     * Entfernt alle Zusatzeffekte dieser Karte und synchronisiert das XML-Feld.
     * <p>
     * Leert die {@code zusätze}-Liste und aktualisiert das {@code zusatzForXml}-Feld für die Serialisierung.
     * </p>
     */
    public void clearZusätze() {
        if (this.zusätze != null) {
            this.zusätze.clear();
        }
        syncZusätzeToXml(); // XML-Feld synchronisieren
    }

    /**
     * Synchronisiert das Zusatzkarten-Feld für die XML-Serialisierung.
     * <p>
     * Setzt {@code zusatzForXml} auf das erste Element aus {@code zusätze}, falls vorhanden, 
     * andernfalls auf {@code null}. Wird für die Speicherung der Karte benötigt.
     * </p>
     */
    private void syncZusätzeToXml() {
        if (zusätze == null || zusätze.isEmpty()) {
            this.zusatzForXml = null;
        } else {
            this.zusatzForXml = zusätze.iterator().next();
        }
    }

    // ──────────────── Hilfsmethoden ────────────────
    
    /**
     * Erstellt eine Standard-Beschreibung für Karten ohne Effekt.
     * <p>
     * Gibt eine Zeichenkette im Format „Farbe Nummer: Diese Karte hat keinen Effekt.“ zurück. 
     * Falls Farbe oder Nummer nicht gesetzt sind, wird „???“ angezeigt.
     * </p>
     *
     * @return Die generierte Standardbeschreibung für eine Karte ohne Effekt.
     */
    private String getNullBeschreibung() {
        String farbeStr = (this.getFarbe() != null) ? this.getFarbe().getDisplayName() : "???";
        String nummerStr = (this.getNummer() != null) ? this.getNummer().getDisplayName() : "???";
        System.out.println("DEBUG: farbeStr=" + farbeStr + ", nummerStr=" + nummerStr);
        return String.format("%s %s: Diese Karte hat keinen Effekt.", farbeStr, nummerStr);
    }

    


    /**
     * Gibt eine String-Repräsentation dieser Karte zurück.
     * <p>
     * Die Ausgabe enthält Nummer, Farbe, Zusätze, Beschreibung und Preis der Karte – nützlich für Debugging und Logging.
     * </p>
     *
     * @return Eine lesbare String-Darstellung dieser Karte.
     */
    @Override
    public String toString() {
        return "Karte{" +
                "nummer=" + nummer +
                ", farbe=" + farbe +
                ", zusätze=" + zusätze +
                ", beschreibung='" + beschreibung + '\'' +
                ", preis=" + preis +
                '}';
    }
}