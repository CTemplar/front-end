// Angular
import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { HttpParams } from "@angular/common/http";

// Helpers
import { apiHeaders, apiUrl } from "../config";

// Models
import { Comment, Post } from "../models";

// Rxjs
import { map } from "rxjs/operators";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

@Injectable({ providedIn: "root" })
export class BlogService {
  constructor(private http: HttpClient) {}

  getPost(slug): Promise<Post>  {
    const endpoint = `${apiUrl}/blog/posts/${slug}/`;
    return this.http.get<Post>(endpoint)
    .toPromise();
  }

  getPosts(limit = 64, offset = 0): Promise<Post[]> {
    const endpoint = `${apiUrl}/blog/posts/`;
    let params = new HttpParams();
    // params.append("limit", limit.toString());
    // params.append("offset", offset.toString());
    return this.http
      .get<Post[]>(endpoint, { params })
      .pipe(map(data => data["results"]))
      .toPromise();
  }

  // postComment(body): Observable<Comment> {
  //   const url = `${this.apiUrl}blog/comments/`;
  //   return this.http.post<Comment>(url, body, apiHeaders());
  // }

  // getRelatedPosts(cateogry) {
  //   const url = `${this.apiUrl}blog/posts/?category=${cateogry}`;
  //   return this.http.get<Post>(url)
  //     .pipe(
  //       map(data => data['results'])
  //     );
  // }
}
