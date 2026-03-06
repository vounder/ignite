package de.drvbund.jauns.main;

public abstract class ShopArtikel {
	
	private Integer preis;
	
	private String beschreibung;
	
    private int loaderIndex;

	public int getLoaderIndex() {
		return loaderIndex;
	}

	public Integer getPreis() {
		return preis;
	}

	public String getBeschreibung() {
		return beschreibung;
	}
	
}
