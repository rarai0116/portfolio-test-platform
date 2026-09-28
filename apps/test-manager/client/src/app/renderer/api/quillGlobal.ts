import Quill from 'quill';

if (typeof window !== 'undefined') {
  window.Quill = Quill;
}
export default Quill; // CJS 側の require('Quill') からも参照される
