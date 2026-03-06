package de.drvbund.jauns.main;

import java.util.ArrayList;
import java.util.Collections;

import jakarta.xml.bind.annotation.XmlAccessType;
import jakarta.xml.bind.annotation.XmlAccessorType;
import jakarta.xml.bind.annotation.XmlRootElement;

@XmlRootElement
@XmlAccessorType(XmlAccessType.FIELD)
public class Deck {

	private ArrayList<Karte> deck = new ArrayList<Karte>();

	public Deck() {} //leerer Konstruktor für JAXB

	
	//Getter
	public ArrayList<Karte> getDeck() {
		return deck;
	}

	//Setter
	public void setDeck(ArrayList<Karte> deck) {
		this.deck = deck;
	}
	
	
	//Methoden
	
    public void mischen() {
        Collections.shuffle(deck);
    }
    
    public void add(Karte karte) {
    	deck.add(karte);
    }
    
    public void remove(int index) {
    	deck.remove(index);
    }


	public void addAll(ArrayList<Karte> kartenListe) {
		deck.addAll(kartenListe);
	}
    
}
