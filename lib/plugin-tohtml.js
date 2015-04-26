/** every row conforms to [tag, {attr:value}, <optional>text]
 */
OrgQuery.prototype.toTree = function() {
  var rtn = [];
  
  var self = this;
  self.MAX_HEADLINE_LEVEL = 6;
  self.OL = 'ol';
  self.UL = 'ul';
  self.DL = 'dl';

  function proc_headline(node) {
    if(node.level <= self.MAX_HEADLINE_LEVEL) {
      return ["h"+node.level, {}, node.headline];
    }
  }
  function paragraphparser(paragraph) {
    var rtn = [];
    var lastgroup = null;
    var lsline = paragraph.split("\n");
    var i = 0,
        n = lsline.length;
    while(i < n) {
      var line = lsline[i++];
      var m = null;
      if(line.length == 0) {
        rtn.push(["br", null, null]);
      } 
      // horizontal rule
      else if(line.match(/-{5,}\s*$/)) {
        rtn.push(["hr", null, null]);
        return rtn;
      } 
      // begin source
      // WARNING: we assume this is well-formed and expect to find an end source!
      else if(m = line.match(/^#\+begin_src\s+([^ ]+)(.*)/i)) {
        var arr_inner = [];
        // end source
        for(;lsline[i] && !lsline[i].match(/^#\+end_src\s*/i);++i) {
          arr_inner.push(lsline[i]);
        }
        // discard end_src
        ++i;
        rtn.push(["code", {class:m[1]}, arr_inner.join("\n")]);
      }
      // simple markup
      else {
        rtn = rtn.concat(parse_inline_markup(line));
      }
    }
    return rtn;
  }

  /** 
   * will return an array of arrays of parsed items
   */
  function parse_inline_markup(line) {
    var rtn = [];
    // simple markup
    var matcher_list = [
      // code
      ["code", /=([^=]+?)=/, null, null],
      // verbatim
      ["code", /~([^~]+?)~/, null, null],
      // italic
      ["i",    /\/(.+?)\//, null, null],
      // bold
      ["b",    /\*([^\*]+?)\*/, null, null],
      // underline
      ["span", /_([^_]+?)_/, function() {return {style:"text-decoration:underline"}}, null],
      // image file, double bracket
      ["img", /\[\[file:\s*([^ ]+)\.(?:PNG|JPG|BMP|GIF|TIFF|SVG)\]\]/i, function(m) {return {src:m[1, null],alt:m[1]}}],
      // image file, no bracket
      ["img", /(?:^|[^[])file:([^ ]+)\.(?:PNG|JPG|BMP|GIF|TIFF|SVG)(?:[^\]]|$)/i, function(m) {return {src:m[1, null],alt:m[1]}}],
      // hyperlink with description
      ["a", /\[\[(?:file:)?(.*?)\]\[(.*?)\]\]/i, function(m) {return {href: m[1]}}, function(m) {return m[2]}],
      // hyperlink without description
      ["a", /\[\[(?:file:)?(.*?)\]\]/i, function(m) {return {href: m[1]}}, null],
    ];
    var remainder = line;
    for(var i=0;i<matcher_list.length;++i) {
      if(remainder.length == 0) {
        break;
      }
      var tag = matcher_list[i][0],
          pattern = matcher_list[i][1],
          attrfn = matcher_list[i][2],
          textfn = matcher_list[i][3];
      var m = remainder.match(pattern);
      if(m !== null) {
        if(m.index > 0) {
          rtn = rtn.concat(parse_inline_markup(remainder.substring(0, m.index)));
        }
        rtn.push([tag, 
                  attrfn ? attrfn(m) : {},
                  textfn ? textfn(m) : m[1]]);
      } else {
        continue;
      }
      remainder = remainder.substr(m.index+m[0].length);
    }
    if(remainder.length > 0) {
      rtn.push(remainder);
    }
    return rtn;
  }

  for(var i = 0; i < self.allNodes.length; ++i) {
    node = self.allNodes[i];
    if(node.headline) {
      rtn.push(proc_headline(node));
    }
    rtn = rtn.concat(paragraphparser(node.body));
  }
  return rtn;
}

/** removes the 2nd {} object in each row after calling toTree()
 * so every row conforms to [tag, <optional>text]
 */
OrgQuery.prototype.toSimpleTree = function() {
  var rtn = [];
  var tree = this.toTree();
  for(var i=0;i<tree.length;++i) {
    var row = tree[i];
    if(typeof row == "string") {
      rtn.push(row);
    } else {
      rtn.push(row.slice(0,1).concat(row.slice(2)));
    }
  }
  return rtn;
}

OrgQuery.prototype.toHTML = function() {
  function tree2html(tree) {
    if(typeof tree == "string") {
      return tree;
    } else if(!tree) {
      return;
    }
    if(tree[1] === null
       || (tree[1] && Object.prototype.toString.call(tree[1]) == "[object Object]")) {
      // is itself a tree
      var de = document.createElement(tree[0]);
      var attr = tree[1] || {};
      var klist = Object.keys(attr);
      for(var i=0;i<klist.length;++i) {
        de.setAttribute(klist[i], attr[klist[i]]);
      }
      de.innerHTML = tree2html(tree.slice(2));
      return de.outerHTML;
    } else {
      // a flat list of maybe tree
      var rtn = [];
      for(var i=0;i<tree.length;++i) {
        rtn.push(tree2html(tree[i]));
      }
      return rtn.join("");
    }
  }
  
  return tree2html(this.toTree());
}
