import BasicCreatableSelect from '@components/organism/basicCreatableSelect';
import { Input } from '@ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/select';

const UiTester = () => {
  const options = [
    { value: 'tag1', label: 'タグ1' },
    { value: 'tag2', label: 'タグ2' },
    { value: 'tag3', label: 'タグ3' },
  ];

  return (
    <div>
      <Select>
        <SelectTrigger className="w-25">
          <SelectValue placeholder="" />
        </SelectTrigger>
        <SelectContent className="w-25">
          <SelectGroup>
            <SelectItem value="1級">1級</SelectItem>
            <SelectItem value="2級">2級</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Input placeholder="通常のInputコンポーネント" className="mb-4" />
      <BasicCreatableSelect defaultOption={options} />
    </div>
  );
};
export default UiTester;
