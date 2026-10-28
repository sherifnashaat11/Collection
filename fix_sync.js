// ملف ربط القائمة بمربع النص تلقائياً
document.addEventListener('DOMContentLoaded', function() {
    // دالة للبحث عن العناصر
    function linkElements() {
        // 1. البحث عن القائمة المنسدلة (Select) الخاصة بالعمارة
        const selects = document.querySelectorAll('select');
        let buildingSelect = null;
        selects.forEach(sel => {
            if (sel.parentElement && sel.parentElement.innerText.includes('العمارة')) {
                buildingSelect = sel;
            }
        });

        // 2. البحث عن مربع النص (Input) الخاص برقم العمارة
        const inputs = document.querySelectorAll('input');
        let buildingInput = null;
        inputs.forEach(inp => {
            if (inp.parentElement && inp.parentElement.innerText.includes('رقم العمارة')) {
                buildingInput = inp;
            }
        });

        // لو لقينا العنصرين، نربطهم ببعض
        if (buildingSelect && buildingInput) {
            
            // لما تختار من القائمة، يكتب في المربع
            buildingSelect.addEventListener('change', function() {
                buildingInput.value = this.value;
                // إبلاغ التطبيق إن القيمة اتغيرت عشان يفتح الشقق
                buildingInput.dispatchEvent(new Event('input', { bubbles: true }));
                buildingInput.dispatchEvent(new Event('change', { bubbles: true }));
            });

            // لما تكتب في المربع، القائمة تتغير
            buildingInput.addEventListener('input', function() {
                const typedValue = this.value;
                for (let i = 0; i < buildingSelect.options.length; i++) {
                    if (buildingSelect.options[i].value === typedValue || buildingSelect.options[i].text === typedValue) {
                        buildingSelect.selectedIndex = i;
                        buildingSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        break;
                    }
                }
            });
            
            console.log("تم ربط العمارة بنجاح!");
        }
    }
    
    // تنفيذ الربط بعد تحميل الصفحة بجزء من الثانية
    setTimeout(linkElements, 1000);
});