package de.drvbund.jauns.main;

import java.nio.file.Path;
import java.util.EnumSet;

import jakarta.xml.bind.annotation.XmlAccessType;
import jakarta.xml.bind.annotation.XmlAccessorType;
import jakarta.xml.bind.annotation.XmlRootElement;
import jakarta.xml.bind.annotation.XmlTransient;

@XmlRootElement
@XmlAccessorType(XmlAccessType.FIELD)
public class Item extends ShopArtikel {

	private Integer preis = 0;
	private String beschreibung = null;
	private EnumSet<Effekt> effekte = null;
	private int loaderIndex = 0;

	@XmlTransient
	private Path grafikPath = null;
	private String grafikPathString;


	//Konstruktoren
	public Item() {} //leerer Konstruktor für JAXB

	/**
	 * Konstruktor für ein Item-Objekt.
	 * Initialisiert Preis, Beschreibung, Effekte, Grafik-Index und den Pfad zur Grafik.
	 *
	 * @param preis         Preis des Items
	 * @param beschreibung  Beschreibung des Items
	 * @param effekte       Menge der Effekte, die das Item hat
	 * @param loaderIndex   Index des geladenen Bildes im Ressourcen-Loader
	 * @param grafikPath    Pfad zur Grafikdatei des Items
	 */
	public Item(Integer preis, String beschreibung, EnumSet<Effekt> effekte, int loaderIndex,  Path grafikPath) {
		super();
		this.preis = preis;
		this.beschreibung = beschreibung;
		this.setEffekte(effekte);
		this.loaderIndex = loaderIndex;
		this.grafikPath = grafikPath;
		this.grafikPathString = grafikPath != null ? grafikPath.toString() : null;
	}

	// Getter
	public Integer getPreis() {
		return preis;
	}

	public String getBeschreibung() {
		return beschreibung;
	}

	public Path getGrafikPath() {
		return grafikPath;
	}

	public String getGrafikPathString() {
		return grafikPathString;
	}

	// Setter
	public void setPreis(Integer preis) {
		this.preis = preis;
	}

	public void setBeschreibung(String beschreibung) {
		this.beschreibung = beschreibung;
	}

	public void setGrafikPath(Path grafikPath) {
		this.grafikPath = grafikPath;
		this.grafikPathString = grafikPath != null ? grafikPath.toString() : null;
	}

	public void setGrafikPathString(String grafikPathString) {
		this.grafikPathString = grafikPathString;
		if (grafikPathString != null) {
			this.grafikPath = Path.of(grafikPathString);
		}
	}

	public int getLoaderIndex() {
		return loaderIndex;
	}

	public void setLoaderIndex(int loaderIndex) {
		this.loaderIndex = loaderIndex;
	}

	public EnumSet<Effekt> getEffekte() {
		return effekte;
	}

	public void setEffekte(EnumSet<Effekt> effekte) {
		this.effekte = effekte;
	}
	
	
	
    public void anwenden(GamePlay gamePlay) {
        if (effekte == null || effekte.isEmpty()) return;

        for (Effekt effekt : effekte) {
            effekt.ausführen(this, gamePlay);
        }
    }
	
	
	
} 