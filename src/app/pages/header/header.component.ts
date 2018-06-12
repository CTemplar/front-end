// Angular
import { Component, HostListener, Inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { DOCUMENT } from "@angular/common";

// Service

@Component({
  selector: "app-pages-header",
  templateUrl: "./header.component.html",
  styleUrls: ["./header.component.scss"]
})
export class PagesHeaderComponent {
  // Public property of boolean type set false by default
  public navIsFixed: boolean = false;
  public menuIsOpened: boolean = false;

  // Switch the footer call to action for this view.
  externalPageCallToAction: boolean = false;

  constructor(
    @Inject(DOCUMENT) private document: any,
    private route: ActivatedRoute,
    public router: Router
  ) {}

  // == Setup click event to toggle mobile menu
  toggleState() {
    // click handler
    const bool = this.menuIsOpened;
    this.menuIsOpened = bool === false ? true : false;
  }

  // == Listening to scroll event for window object
  @HostListener("window:scroll", [])
  onWindowScroll() {
    const number =
      window.scrollY ||
      this.document.documentElement.scrollTop ||
      this.document.body.scrollTop ||
      0;
    if (number > document.getElementById("mastHead").offsetHeight) {
      this.navIsFixed = true;
    } else if (this.navIsFixed && number < 10) {
      this.navIsFixed = false;
    }
  }

  closeMenu() {
    this.menuIsOpened = false;
  }
}
